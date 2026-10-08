# Phase 6B.1 — security and staging preflight

Date: 2026-10-09 (Asia/Colombo). Scope: first controlled Railway staging deployment; **no deployment or production migration was performed**.

## Baseline and decision

- Validated Phase 6A integration base: `b640edfafc1e30e20309d0441e1153da3688faea` on `codex/radar-phase6-integration`; its worktree was clean.
- Remediation branch: `codex/radar-phase6b1-preflight`, forked from that commit. Validated remediation commit: `17dc30745d326de38fc4e584c691643b142a13ae`.
- The active `main` checkout was not modified, and nothing was pushed or merged.
- **Staging go/no-go: GO for Phase 6B.2 controlled staging setup, subject to the configuration and manual gates below.** This does not approve production traffic, paid judgments, production migrations, or production risk acceptance.

## Dependency audit

Baseline commands: `npm audit --omit=dev --json`, `npm audit --json`, and `npm ls --all`. The baseline lockfile had **7 high + 1 low** production-classified package findings and **8 high + 2 moderate + 1 low** total package findings. npm aggregates multiple advisory IDs under one package finding. The full tree resolved without missing required packages; optional unmet packages are expected. Reachability below is assessed against the production Docker image and exposed server paths, not merely npm's dependency classification.

| Scope | Package (baseline → patch) | Advisory IDs / baseline severity | Directness; production reachability | Compatibility and remediation |
| --- | --- | --- | --- | --- |
| Development-only | `@vitest/mocker` 4.1.5 → 4.1.11 | GHSA-82fw-gwwq-j7x9; moderate | Transitive; No; tests only | Updated without major runtime API change |
| Production-classified | `esbuild` 0.27.7 → 0.27.7 | GHSA-g7r4-m6w7-qqqr; low | Transitive; Build/dev server only; no Windows server in staging | Unchanged; low Windows-only issue, no compatible Vite-range patch yet |
| Production-classified | `fast-uri` 3.1.2 → 3.1.8 | GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp, GHSA-4c8g-83qw-93j6, GHSA-qw65-cvwx-89v3, GHSA-hrr3-gc8f-f4qj; high | Transitive; Potentially reachable through Fastify schema/URI validation | Updated without major runtime API change |
| Production-classified | `fastify` 5.8.5 → 5.12.5 | GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, GHSA-4mh8-r7rc-xpvc, GHSA-667r-xxjv-c9mm, GHSA-p68q-wchp-6fh7, GHSA-hwr6-493r-vm6h, GHSA-9q9j-q6p8-xq58; high | Direct; Yes, all API requests | Updated without major runtime API change |
| Production-classified | `find-my-way` 9.6.0 → 9.9.0 | GHSA-c96f-x56v-gq3h; high | Transitive; Yes, HTTP routing | Updated without major runtime API change |
| Production-classified | `nanoid` 3.3.12 → 3.3.20 | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8; high | Transitive; Build pipeline only via PostCSS | Updated without major runtime API change |
| Production-classified | `postcss` 8.5.14 → 8.5.29 | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849; high | Transitive; Build pipeline only | Updated without major runtime API change |
| Production-classified | `source-map-js` 1.2.1 → 1.2.2 | GHSA-68fv-2mgg-jv7q; high | Transitive; Build pipeline only | Updated without major runtime API change |
| Development-only | `undici` 7.25.0 → 7.30.0 | GHSA-vmh5-mc38-953g, GHSA-p88m-4jfj-68fv, GHSA-vxpw-j846-p89q, GHSA-hm92-r4w5-c3mj, GHSA-g8m3-5g58-fq7m, GHSA-pr7r-676h-xcf6, GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272, GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm, GHSA-35p6-xmwp-9g52, GHSA-pmjh-fq2x-6v4x, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5, GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-2gqq-gqf2-x968, GHSA-w293-vg96-wgc3, GHSA-8436-99hf-9mmv, GHSA-rx4f-c7p8-82vq; high | Transitive; No; jsdom/test tree | Updated without major runtime API change |
| Production-classified | `vite` 8.0.11 → 8.3.4 | GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff; high | Direct; Build pipeline only | Updated without major runtime API change |
| Development-only | `vitest` 4.1.5 → 4.1.11 | GHSA-82fw-gwwq-j7x9; moderate | Direct; No; tests only | Updated without major runtime API change |

The remediation used compatible package updates without `--force`. Fastify 5 remains on the same major; Vite 8 remains on the same major; Vitest is pinned to patched 4.1.11 because Vitest 5 requires a newer Node line than the `node:20-slim` build image. Vite and `@vitejs/plugin-react` are now development dependencies because they build static assets and are not loaded by the running API. `npm audit --omit=dev --json` is **0 findings** after remediation. `npm audit --json` is **1 low finding**: esbuild 0.27.7, GHSA-g7r4-m6w7-qqqr, a Windows development-server file-read issue. Staging runs Linux and does not expose a Vite/tsx development server; this low development risk is recorded, not a high/critical acceptance. Do not use a forced esbuild override across Vite's declared range without a compatibility check.

No high or critical production vulnerability remains; no high or critical risk acceptance is requested. Re-audit the lockfile before Phase 6B.2 because advisories can change.

## Production configuration matrix

| Binding | Staging setting / gate | Code behavior |
| --- | --- | --- |
| `NODE_ENV`, `PORT` | `production`; Railway injected port | Production validation requires explicit port; Fastify listens on `0.0.0.0`. |
| `DATABASE_URL` | Staging PostgreSQL **private-network** URL; separate credentials | Missing/invalid URL fails startup; `/readyz` requires reachable DB, schema, and its configured migration subset. An external ledger must cover all 17 migrations. |
| `PAYSH_CATALOG_SOURCE`, `PAY_SH_CATALOG_URL`, `PAYSH_ALLOW_FIXTURE_FALLBACK` | `live`; approved HTTPS catalog URL; `false` | Missing/fixture/unsafe values fail startup. `/readyz` requires fresh live catalog, not fixture evidence. |
| `ADMIN_TOKEN` | Unique staging secret, never production value | Missing token closes admin routes and degrades config; set for controlled evaluation and receipt authority testing. `INFOPUNKS_ADMIN_TOKEN` is an alias. |
| `FRONTEND_ORIGIN` | Exact staging HTTPS origin | CORS allows this plus built-in production/legacy/local origins. CORS is not authentication. |
| `JUDGMENT_PAYMENT_ENABLED` | `false` | Paid judgment gateway stays off. No facilitator, pay-to wallet, or judgment signing private key in staging. |
| `ECONOMIC_ENGINE_ENABLED`, `ECONOMIC_ENGINE_AUTHORIZATION_ENABLED`, `ECONOMIC_ENGINE_JEV_ENABLED` | `false` | Internal economic engine and execution authorization routes remain disabled. |
| `MACHINE_EXECUTION_ENABLED`, `MONITOR_ENABLED`, `MONITOR_MODE`, `MONITOR_ALLOW_PAID_ENDPOINTS` | `false`, `false`, `disabled`, `false` | No machine execution or paid endpoint monitor probes. |
| `RH_4663_PHASE2_ENABLED`, `RH_4663_PHASE3_ENABLED`, `RH_4663_AUTO_PUBLICATION_ENABLED`, `RH_4663_EXTERNAL_DISTRIBUTION_ENABLED` | `false` | No resolution signing, automated publication, or external distribution. Leave resolution/anchor private keys unset. |
| `IPX_LAUNCH_POLICY_PATH`, `IPX_PLTR_SHADOW_OBSERVATION_ENABLED` | Unset; `false` | Avoid unrelated IPX launch/economic functionality and shadow worker activity. |
| `EXECUTION_PROOF_BASE_RPC_URL`, `JUDGMENT_RH_RPC_URL` | Unset for first staging boot | Public proof submissions fail closed until a verified RPC and relevant indexes are deliberately enabled; no real settlement proof intake is part of first boot. |
| `PAYSH_BOOTSTRAP_ENABLED`, `INGESTION_ENABLED` | `true`, `true` | Live catalog load must succeed for readiness; no fixture fallback. |

`verifyRuntimeConfiguration` was exercised with placeholder values only: the complete production invariant plus a placeholder admin token returned `valid`; missing `DATABASE_URL`, fixture catalog, and `PAYSH_ALLOW_FIXTURE_FALLBACK=true` returned `invalid`. Without the admin token, verification returned `degraded` and closed admin routes. No secret value was printed.

## Authentication, authorization, and authority

- Canonical observation, judgment, execution, and evaluation writes are under `/internal/receipt-spine/*` and require an admin bearer token. `/v1/evaluate` also requires it and calls `EvaluationService.submit`; the internal evaluation route calls `EvaluationService.createEvaluation`. Caller-authored score/delta fields are rejected. The service alone derives outcome deltas; the PostgreSQL constraints and append-only guards protect stored receipts. `tests/security/score-authority.test.ts` and Phase 6 route tests cover authority boundaries. **Authority violations: F = 0** in the tested negative paths.
- `/v1/execute-proof` is public, bounded to 16 KiB and 20 requests/minute/IP per process. It requires a real verifier for eligible proofs, checks timing/ancestry/settlement, and uses unique authorization and settlement indexes; absent RPC it returns unavailable rather than accepting synthetic execution. The paid judgment aliases share a 30 requests/minute/IP limiter. These in-process limiters do not coordinate across replicas; first staging should use one API replica and put an edge limit in front of public writes before scale-out.
- `/v1/receipts` is a legacy public pre-spend receipt intake. It rejects nonzero `confidence_delta` and does not write the canonical score projection, but its in-process receipt list can affect legacy route summaries/recommendations. It has no route-specific rate limit. `/v1/validation/submit` and other public intake routes are separate from canonical authority. Restrict staging exposure and add edge limits; this is an operational hardening item before broad public traffic.
- Evaluation-request intake creates a request for review, not a canonical evaluation or score update. Admin/reviewer actions require bearer credentials. Signing-key material is read server-side from environment and only public issuer keys are returned. Do not set private keys in this staging environment.
- Receipt IDs, request hashes, idempotency keys, uniqueness indexes, and append-only database triggers prevent replay or mutation on canonical paths. PostgreSQL evidence below verifies constraint and replay behavior. CORS uses an allowlist; non-browser clients still require route authentication. Generic 5xx responses and sanitized operational logging limit error leakage; validation errors can reveal field names, so avoid placing secrets in request bodies.
- Residual review item: the shared `isAdmin` helper and some IPX reviewer checks use ordinary string comparison; economic-engine auth uses `timingSafeEqual`. Stage behind restricted access and rotate unique staging tokens. A constant-time comparison change can be separately reviewed before broad exposure. IPX genesis routes are inert when no launch policy is configured.

## Railway staging architecture and runbook

Design a separate **staging environment** with one Docker-built Radar API service and one PostgreSQL service, isolated from production credentials and volumes. Bind `DATABASE_URL` to the PostgreSQL service's private-network URL/reference. Keep public access limited to the staging API and an approved staging hostname. The repo currently has a Render manifest, not a Railway service manifest; configure Railway services and variables in Phase 6B.2 after reviewing the environment diff. Railway's newer Infrastructure as Code is preferred over its deprecated config-as-code file for eventual checked-in topology ([reference](https://docs.railway.com/infrastructure-as-code/reference), [legacy deprecation](https://docs.railway.com/config-as-code/reference)).

1. Create the isolated Railway staging environment, API service from the validated commit, and PostgreSQL service. Use the existing multi-stage Dockerfile and `npm start`. Bind staging-only variables from the matrix; verify no production DB URL or wallet signing key is present.
2. Back up the **staging** database before migration. From an operator-controlled, single-run job on the private network, maintain a migration ledger and apply pending `migrations/*.up.sql` in numeric order with `ON_ERROR_STOP=1`. Do not run all files on every deploy: 011, 016, and 017 are one-time and intentionally reject repeat application. The current Docker runtime image lacks `psql`, so do not set a speculative `preDeployCommand` until a migration image/runner with `psql` and ledger is prepared. Railway pre-deploy commands can reach private services and block deployment on failure ([docs](https://docs.railway.com/deployments/pre-deploy-command)).
3. Set Railway deployment healthcheck path to **`/readyz`**, with enough timeout for live catalog bootstrap. `/healthz` is liveness only and must be separately polled. Railway deploy healthchecks run at deployment time, so configure ongoing external readiness polling ([docs](https://docs.railway.com/deployments/healthchecks)). The app's `/readyz` migration check covers a selected RH Chain/canonical subset, not every 001–017 migration; confirm the full external migration ledger separately. Also confirm live catalog freshness, DB persistence mode, no disabled mandatory features, and `JUDGMENT_PAYMENT_ENABLED=false` before opening controlled traffic.
4. Collect structured API stdout/stderr and PostgreSQL logs in Railway Log Explorer. Alert on deploy failure/crash, `/readyz` 503, database errors, migration drift, 5xx and 429 rates, stale catalog, and backup failures. Railway's native metrics cover CPU, memory, disk, and network; application latency/error SLOs require exported telemetry or an external probe ([logs](https://docs.railway.com/observability/logs), [metrics](https://docs.railway.com/observability/metrics), [alerts](https://docs.railway.com/observability)). Redact tokens, DB URLs, payment signatures, and request bodies in all exports.
5. Enable staging PostgreSQL scheduled volume backups, review point-in-time recovery availability, and retain encrypted logical `pg_dump` copies outside the service. Rehearse restore into a **new** staging DB before trusting it ([Railway backup guide](https://docs.railway.com/guides/postgres-backups-restores)).
6. Roll back application code/flags first and hold traffic if readiness fails. Keep additive tables and canonical receipts. Never run a destructive down migration as routine rollback. If data recovery is needed, restore a verified backup into a fresh database, replay the canonical chain, compare projection hashes, then switch the staging binding after review. Forward-fix schema errors when possible.

## Local PostgreSQL migration and recovery evidence

Disposable local PostgreSQL 14 databases `radar_phase6b1_rehearsal` and `radar_phase6b1_restore` were used; no remote/production database was touched. All 17 ordered `.up.sql` migrations applied cleanly from empty state. The source schema contained **42 tables and 126 indexes**. A canonical observation → judgment → execution → evaluation chain was created through `ReceiptAuthorityService` and `EvaluationService`; its score was 5 and projection hash was `sha256:ef6db141c9b8bd29e9ba62d3e066bd4e54dd2ecbd973c38ca36d507357bab6c2`. `pg_dump -Fc` and `pg_restore --exit-on-error` into the fresh database completed. The restored schema again had 42 tables and 126 indexes; chain verification returned true and the rebuilt score, evaluation count, and projection hash matched exactly. Both disposable databases and the test-only dump were removed after verification.

The dedicated `phase6-migrations` test passed for baselines 000, 010, 014, and 017, including historical receipt preservation, complete replay, schema/constraint/index equality, FK and policy rejection, append-only guards, and explicit refusal of unsafe repeat migrations. Never infer that a production down migration is safe from this local rehearsal.

## Validation gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test -- --maxWorkers=4` with disposable PostgreSQL | PASS: 265 files, 1,891 tests |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Dedicated PostgreSQL durability and migration upgrade | PASS: 10 files, 51 tests; baselines 000/010/014/017 |
| Phase 5 closed-loop proof | PASS: local adapters, 21 negative cases, score −15, restart replay true |

An initial full-suite attempt used a Unix-socket URL and was rejected by the Phase 5 harness's explicit `localhost` safety check. A subsequent `localhost` run had one intermittent frontdoor mock-source timeout under competing local test load; that test passed in isolation. The final complete run, with the required `localhost` URL and no competing test workload, passed all 1,891 tests. This is test-environment timing sensitivity, not a waived failing final gate; rerun the same gate if the checkout changes.

## Phase 6B.2 gate

Proceed only with the remediation commit, the exact staging variable matrix, an isolated staging Postgres binding, an operator-owned migration ledger/runner, backup/restore capability, `/readyz` deploy healthcheck, ongoing probe and alerts, and documented rollback owner. Any new high/critical production advisory, failed test, migration mismatch, receipt-chain/hash mismatch, or unexpected paid/execution flag changes the decision to **NO-GO**. No paid judgments, production migrations, Railway deployment, push, or merge occurred in Phase 6B.1.
