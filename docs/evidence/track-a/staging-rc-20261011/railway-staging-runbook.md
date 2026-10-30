# Controlled Railway staging handoff

**Decision: HOLD.** This packet prepares one reviewable local candidate; it does not authorize deployment or assert staging/production readiness. No service, database, DNS, production secret, funded transaction, IPX or PLTR financial deployment was touched.

## Reviewed inputs and immutable selection

Use `deployment/railway-staging-manifest.json`, its optional `.ts.example` IaC template, `release-manifest.json`, `integration-ledger.md`, `migration-checksums.json` and the validation records together. The source SHA in the release record is immutable; evidence-only commits may follow it and are explicitly distinguished. Do not select a moving branch tip or merge PR #6. Push/autodeploy and image publication remain outside this handoff.

Railway's current preferred authoring format is TypeScript Infrastructure as Code. The example is deliberately not auto-loaded, has no GitHub source/autodeploy binding, and has not been applied or validated against an operator project. It references staging shared variables by name, never a secret value. The operator must review the exact project/environment, image source, builder, networking and restart settings in the generated plan. [Railway IaC reference](https://docs.railway.com/infrastructure-as-code/reference).

## Conditions to clear HOLD before an operator deploys

1. Independently review the isolated candidate diff, new production authorization behavior, Node 24.21.0 runtime, and additive migration 022. Retain historical 001–021 checksums. Approve only the controlled read/assessment profile; no reviewer, model, execution or payment activation is included.
2. Build the exact candidate Docker image in a Linux environment with Docker available; run the image's runtime verifier, migration CLI and startup smoke. Record immutable image digest, OS/runtime and container security scan. Local macOS build/test evidence does not establish Linux image parity. Docker was unavailable during this preparation.
3. Provision a new Railway **track-a-staging** environment and private PostgreSQL, isolated from production databases/volumes/credentials. Record environment/service IDs and separate migration/runtime roles. Disable GitHub autodeploy. Verify that `DATABASE_URL` resolves to the staging private service, not a TCP public proxy or production target. [Private networking](https://docs.railway.com/networking/private-networking), [PostgreSQL](https://docs.railway.com/databases/postgresql).
4. Bind an approved **live HTTPS catalog** and exact staging frontend origin. Configure restricted operator/tester ingress and an edge limiter. Keep one API replica; application limits are process-local. Unknown/unsupported intents must abstain without charge; stale catalog, fixture evidence, DB failure and pending migrations must make `/readyz` return 503.
5. Name the rollback owner, alert recipient and backup/restore operator. Enable staging backups with at least seven days of retention; retain encrypted logical backups outside the service. Rehearse restoration into a **new staging database**, including canonical JSON/hash/signature/context/tape replay comparison. A local restore is supporting evidence only.

## First boot variable contract

Set `NODE_ENV=production`, `RADAR_CONTROLLED_STAGING=true`, `PORT=10000` (or Railway's explicit injected port), `DATABASE_POOL_MAX=4`, `PAYSH_CATALOG_SOURCE=live`, `PAYSH_ALLOW_FIXTURE_FALLBACK=false`, `PAYSH_BOOTSTRAP_ENABLED=true`, `INGESTION_ENABLED=true`, and `MONITOR_MODE=disabled`. Supply only staging `DATABASE_URL`, approved `PAY_SH_CATALOG_URL`, and `FRONTEND_ORIGIN` through the operator secret/config store. Use manifest flag values verbatim; preserve `RADAR_CONTROLLED_STAGING` on every restart and rollback.

All spend/execution/economic/model/IPX/4663 publication flags in the manifest are false. Supply a fresh staging-only ADMIN_TOKEN to satisfy the existing readiness dependency check. INFOPUNKS_ADMIN_TOKEN and dedicated reviewer tokens remain absent. The controlled profile rejects admin mutations even with the correct token. No issuer private key, execution authorization signer, funded-wallet/pay-to binding, facilitator, paid translation header, provider key, reviewer trust registry, launch policy or settlement RPC is supplied. Controlled staging rejects activation settings before boot rather than silently ignoring them. The current readiness implementation reports a missing admin token as a dependency failure, so it must be configured even though staging mutation routes remain closed.

Fixture fallback is **forbidden** for production readiness. Do not switch to development mode, a fixture URL, in-memory persistence or `PAYSH_ALLOW_FIXTURE_FALLBACK=true` to make deployment healthchecks pass. Fixture keys/results in local test logs remain synthetic.

## Migration execution — separate operator job

Application startup runs no DDL. The manifest sets no automatic pre-deploy command. The operator runs `npm run migrations:check` in the separate migration job before deployment; it refuses pending/drifted/unknown histories. The existing validator initializes/verifies its ledger tables and guards, so it needs ledger DDL privileges; it is not a strictly read-only SQL operation. Use a dedicated migration/check job role, keeping its binding outside the API service; do not grant unexplained superuser/ledger-DDL access to the API.

1. Verify target identity through a non-secret environment/service label and operator-confirmed binding. Back up the staging DB before any change. Do not print the connection URL or enable shell tracing.
2. From an approved one-off job using the **exact candidate image** and migration role, run `node dist/server/cli/runPostgresMigrations.js`. Capture JSON and exit status. Require `valid:true`, `database:reachable`, all 22 identities applied, zero pending, zero failures, and checksums matching the frozen ledger.
3. Run `node dist/server/cli/runPostgresMigrations.js --validate` and rerun apply once to prove idempotency (still 22 history entries on a fresh install). Do not loop raw SQL files or run down migrations.
4. An existing unledgered database is refused. Only pre-reviewed pinned 017 or 020 baselines can be explicitly adopted with `--adopt-baseline 017` or `020`, after verified schema signature/checksum review and backup. Unledgered 021 is not supported for implicit adoption; do not invent a baseline or bypass the ledger.
5. Retain migration JSON, timing, checksum and schema evidence. Switch to the restricted runtime role after the migration job. Confirm the two publication sequence indexes for migration 022 are present; old 001–021 readiness alone is insufficient.

Railway pre-deploy commands run within private networking and a failing command stops deployment. This release uses a separately reviewed one-off apply/check job; the optional Railway pre-deploy capability is documented but not configured. [Pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command).

## Controlled traffic and rejection smoke after authorized deployment

Require `/healthz` 200 and `/readyz` 200 with PostgreSQL durable persistence, all required migrations and fresh live catalog timestamps. Configure `/readyz` as deployment healthcheck (300-second timeout). Railway deploy healthchecks do not replace ongoing monitoring; poll `/readyz` and catalog age externally. [Healthchecks](https://docs.railway.com/deployments/healthchecks).

Confirm staging mutation/profile behavior:

- `/v1/pre-spend/check` and `/v1/decide` share the existing 30/minute/IP bound. A free insufficient-evidence result has zero charge, no receipt and no payment challenge. Identical idempotency retry returns identical bytes; changed intent under the same key returns 409.
- Unsupported intent or insufficient/stale/fixture evidence never produces spend permission. With sufficient evidence but payments off, payment-dependent issuance remains unavailable; do not turn on billing to get a positive response.
- A supplied payment signature returns 403 in the controlled profile. No settle call, execution broadcast, authorization or signing is permitted.
- All other POST/PUT/PATCH/DELETE mutations, including legacy receipt/validation intake, execution proof, Evaluation, canonical admin and IPX endpoints, return 403 before handler/body parsing. No correct admin token opens these paths in staging.
- Both score projection endpoints return 503. Production Evaluation endpoints are also closed independently of the staging profile until E1 authority is separately approved. New production judgments with contributing unreviewed Evaluation history return 503; old canonical commitments remain retrievable/replayable.
- Decision View from PR #6 is absent (404). Do not approve its public-data gate by inference from staging access restriction. Existing canonical read surfaces must remain within restricted staging ingress.
- Stop catalog ingestion or sever the staging DB in a controlled test window: readiness must fail, liveness may stay up, and fixture fallback must remain off. Restore dependencies and capture recovery/replay.

Set alert routing for `/readyz` failure, stale catalog, database/migration errors, 5xx/429 rates, invalid signatures/replay and backup failure. Sanitize request bodies, bearer headers, payment signatures and connection URLs in exported logs. Record an on-call receiver and one end-to-end test alert.

## Rollback and abort

On a failed gate, close controlled traffic and retain the failed image/logs/migration JSON. For first boot with no previously approved staging image, stop the service. For subsequent boot, revert to the last **staging-approved** image that retains the controlled guard; never treat main or the older unguarded base as an approved rollback target. Keep all payment/execution/model/IPX flags off.

Keep additive migration 022 and canonical history. No down migrations against populated history: 022 intentionally refuses rollback when published positions exist. Prefer a forward fix. For data recovery, restore the pre-change backup into a new isolated database, compare canonical bytes/signatures/context and publication manifests, review expected data loss, then explicitly approve switching the staging binding. Never restore over production or discard accepted receipts to make a rollback pass.

Any checksum drift, receipt/context/tape mismatch, new high/critical production audit finding, failing mandatory test, wrong database target, lost ingress restriction or enabled authority flag changes the decision to HOLD/abort. Local tests establish neither real paid settlement, causal improvement nor production readiness.
