# Track A Railway staging preparation

## Deployment boundary

No Railway project was accessed and no service, database, credential, DNS, migration, or deployment was created or changed. Railway CLI and Docker Engine were unavailable in this workspace; Railway operator credentials were also unavailable. Deployment remains a human operator action after approval.

## Proposed service topology

- One API service built from the repository `Dockerfile`, with one replica for initial qualification.
- One isolated Railway PostgreSQL service in the same Railway project and staging environment, with private networking only.
- API database connection through Railway's private reference (`${{Postgres.DATABASE_URL}}`), with no public database endpoint.
- Controlled pre-deploy migration step: `npm run migrations:run`; fail the deployment if the command exits nonzero. Never configure automatic down migrations.
- Liveness check: `GET /healthz`. Dependency readiness: `GET /readyz`; promotion requires `ok:true`, a fresh live catalog, and the expected persisted schema.
- App logs: structured JSON stdout/stderr retained in Railway logs. Alert on restart loops, failed deploys, `/readyz` unavailable, database connection loss, stale catalog, and migration runner failures. Configure notification destinations and threshold windows in the Railway project before deployment.
- Enable scheduled PostgreSQL backups and document retention, restore target, and restore operator in the Railway environment. Prove restoration into a separate disposable staging database before any staging promotion.

## Environment matrix (names and policy only)

| Variable / setting | Staging value or policy |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Railway injected value |
| `DATABASE_URL` | private Railway reference to the isolated staging PostgreSQL service |
| `PAYSH_CATALOG_SOURCE` | `live` |
| `PAY_SH_CATALOG_URL` | approved live catalog URL; no credential embedded in URL unless catalog provider requires it |
| `PAYSH_ALLOW_FIXTURE_FALLBACK` | `false` |
| `PAYSH_BOOTSTRAP_ENABLED` | `true` only after catalog access and readiness review |
| `INFOPUNKS_ADMIN_TOKEN` | unique staging-only random secret, stored in Railway variables |
| `JUDGMENT_PAYMENT_ENABLED` | `false` |
| `MACHINE_EXECUTION_ENABLED` | `false` |
| `RH_4663_PHASE2_ENABLED`, `RH_4663_PHASE3_ENABLED`, `RH_4663_AUTO_PUBLICATION_ENABLED` | `false` |
| `IPX_PLTR_SHADOW_OBSERVATION_ENABLED`, `IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED` | `false` |
| signing keys, funded wallets, token authority, production credentials | absent |
| Railway replicas | `1` API; one separate staging PostgreSQL instance |

Do not copy production secrets. Values marked as operator-supplied are still missing external inputs; this file contains no secret values.

## Operator deployment and rollback procedure

1. Create a Railway project/environment named for staging, and create a separate private PostgreSQL service there.
2. Configure the environment matrix above, store staging-only credentials in Railway's secret variable store, and verify that no public database URL is enabled.
3. Deploy the reviewed candidate revision to the single API service. The migration command must execute from the built Docker image and block deploy on nonzero exit.
4. Confirm migration JSON report shows valid inventory, all 21 expected identities applied/adopted, zero pending, zero failures. For an existing database, obtain explicit operator review of a supported baseline before passing `--adopt-baseline 017` or `020`.
5. Check `/healthz`; then check `/readyz` and verify PostgreSQL dependency, schema assertions, live catalog mode and freshness.
6. Exercise read-only route smoke checks and receipt retrieval. Keep payment, signing and execution disabled.
7. Restore the latest PostgreSQL backup to a separate temporary database, validate migration history, receipt hashes/signatures and replay. Record restore timing and evidence.
8. For rollback, redeploy the prior approved API image only if its schema compatibility is confirmed. Do not run down migrations. Restore a database backup only under incident command after preserving the current database and evidence.

## External actions still required

An operator must provide Railway project/environment access, approve the candidate revision, create the isolated PostgreSQL service, supply staging-only admin and catalog credentials if required, configure backup retention and alert destinations, and authorize the staging deployment. No production action is authorized by this runbook.
