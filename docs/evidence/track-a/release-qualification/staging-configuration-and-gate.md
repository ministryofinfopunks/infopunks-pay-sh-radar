# Staging configuration and deployment gate

Deployment was not attempted. `railway` CLI and `docker` are unavailable; no Railway project/service, private-network database, staging credentials, alert destination, or approved deployment revision was supplied. This is the exact external gate. The repository Dockerfile uses Node 20 build/runtime stages and exposes port 10000; it could not be built locally with Docker. `render.yaml` is existing Render configuration and was not treated as Railway staging configuration.

Required staging-only matrix (names only; no secret values recorded):

| Setting | Staging requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | private Railway PostgreSQL URL, separate staging database |
| `PAYSH_CATALOG_SOURCE` | `live` |
| `PAY_SH_CATALOG_URL` | approved HTTPS catalog endpoint |
| `PAYSH_ALLOW_FIXTURE_FALLBACK` | `false` |
| `JUDGMENT_PAYMENT_ENABLED` | `false` |
| `ECONOMIC_ENGINE_ENABLED` | `false` |
| `ECONOMIC_ENGINE_SHADOW_MODE` | `true` |
| `ECONOMIC_ENGINE_JEV_ENABLED` | `false` |
| `ECONOMIC_ENGINE_AUTHORIZATION_ENABLED` | `false` |
| `IPX_LAUNCH_POLICY_PATH` | unset |
| `RH_4663_PHASE2_ENABLED` | `false` |
| `MACHINE_EXECUTION_ENABLED` | `false` |
| `ADMIN_TOKEN` | staging-only secret, set by operator |
| issuer/facilitator/signing credentials | unset while payment is disabled |

Before staging boot: operator provisions isolated private DB, approves the exact image/revision, sets staging-only credentials, runs migrations through a controlled runner/ledger, confirms `/healthz` and `/readyz`, validates live catalog freshness/storage durability, installs critical-failure alerts, and rehearses backup restore. No paid traffic, execution, IPX, or token operation is enabled.
