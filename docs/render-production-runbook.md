# Render production runbook

Radar runs as a Docker web service. Render invokes `./Dockerfile`, exposes port
`10000`, and probes `GET /healthz`. The server binds `0.0.0.0:$PORT`; Render
sets `PORT` automatically. Do not set a port value in the image.

## Configuration verification

Run the deterministic, non-secret verifier before a deploy or from a Render
shell:

```sh
npm run verify:runtime-config
```

It emits one JSON object containing variable names and the states
`configured`, `missing`, or `defaulted`, plus disabled feature names. It never
emits token, password, database URL, payment value, or API key values. An
invalid value exits non-zero. A valid public-only configuration exits zero with
`status: "degraded"`.

## Required Render variables

Render supplies `PORT`. Set `NODE_ENV=production`.

`INFOPUNKS_ADMIN_TOKEN` is required to enable existing admin endpoints. If it
is absent, the public terminal remains up and every admin endpoint remains
closed (no fallback token exists).

`DATABASE_URL` is required only for durable persistence and the RH Chain
features shown in the matrix below. Do not enable their flags without it.

`RH_CHAIN_REVIEW_ADMIN_TOKEN` is required only with
`RH_CHAIN_REVIEW_CONSOLE_ENABLED=true`. The console never falls back to the
general admin token. Without this dedicated token, reviewer routes are hidden.

Declare these secret names with `sync: false` in the Render dashboard or
Blueprint: `INFOPUNKS_ADMIN_TOKEN`, `DATABASE_URL`,
`RH_CHAIN_REVIEW_ADMIN_TOKEN`, `PAY_SH_TRANSLATION_AUTH_TOKEN`,
`PAY_SH_TRANSLATION_PAYMENT_VALUE`, `HERMES_API_KEY`, and (when used)
`EVALUATION_REQUEST_WEBHOOK_URL`. Never commit values.

## Optional runtime variables

Catalog and scheduler: `PAY_SH_CATALOG_URL`, `PAYSH_CATALOG_SOURCE`,
`PAYSH_ALLOW_FIXTURE_FALLBACK`, `PAYSH_BOOTSTRAP_ENABLED`,
`INGESTION_ENABLED`, `PAY_SH_INGEST_INTERVAL_MS`, `MONITOR_ENABLED`,
`MONITOR_MODE`, `MONITOR_INTERVAL_MS`, `MONITOR_TIMEOUT_MS`,
`MONITOR_MAX_PROVIDERS`, `MONITOR_ALLOW_PAID_ENDPOINTS`.

General operation: `DATABASE_POOL_MAX`, `FRONTEND_ORIGIN`, `APP_VERSION`,
`FEATURED_PROVIDER_ROTATION_MS`, `MACHINE_DEMO_SEED`,
`MACHINE_RECEIPTS_JSONL_PATH`, `MACHINE_EXECUTION_ENABLED`.

The optional BigQuery live harness uses
`INFOPUNKS_BIGQUERY_LIVE_HARNESS_ENABLED`,
`INFOPUNKS_BIGQUERY_LIVE_HARNESS_MODE`,
`INFOPUNKS_BIGQUERY_LIVE_HARNESS_VERSION`,
`INFOPUNKS_BIGQUERY_LIVE_CREDENTIALS_CONFIGURED`, and
`INFOPUNKS_BIGQUERY_LIVE_RAIL_CONFIGURED`. `VITE_API_BASE_URL` is a client
build-time variable, not a server runtime dependency. Smoke-script-only
variables (`RADAR_VERIFY_BASE_URL`, `SMOKE_*`) are likewise not service
runtime dependencies.

RH Chain providers: `RH_CHAIN_LIVE_SNAPSHOTS_ENABLED`,
`RH_CHAIN_PROVIDER_TIMEOUT_MS`, `RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS`,
`RH_CHAIN_CACHE_TTL_SECONDS`, `RH_CHAIN_BLOCKSCOUT_URL`, `DEXSCREENER_*`, and
`BLOCKSCOUT_*`.

RH Chain automation: `RH_CHAIN_AUTOMATION_ENABLED`,
`RH_CHAIN_MARKET_INGESTION_ENABLED`, `RH_CHAIN_MARKET_HISTORY_ENABLED`,
`RH_CHAIN_AUTOMATION_INSTANCE_ID`, `RH_CHAIN_JOB_LOCK_TTL_MS`,
`RH_CHAIN_CHAIN_PULSE_INTERVAL_MS`, `RH_CHAIN_MEME_PULSE_INTERVAL_MS`,
`RH_CHAIN_LAUNCHPAD_INTERVAL_MS`, `RH_CHAIN_RECEIPT_DRAFT_CRON`, and
`RH_CHAIN_PUBLIC_RATE_LIMIT_ENABLED`, `RH_CHAIN_PUBLIC_RATE_LIMIT_WINDOW_MS`,
`RH_CHAIN_PUBLIC_RATE_LIMIT_MAX`, `RH_CHAIN_DUPLICATE_WINDOW_MS`.

Machine translation is opt-in: `PAY_SH_TRANSLATION_URL`,
`PAY_SH_TRANSLATION_AUTH_MODE`, `PAY_SH_TRANSLATION_AUTH_HEADER`,
`PAY_SH_TRANSLATION_AUTH_TOKEN`, `PAY_SH_TRANSLATION_PAYMENT_HEADER`,
`PAY_SH_TRANSLATION_PAYMENT_VALUE`, and `PAY_SH_TRANSLATION_TIMEOUT_MS`.
Hermes is opt-in: `HERMES_ENABLED`, `HERMES_BASE_URL`, `HERMES_API_KEY`, and
`HERMES_MODE`. Evaluation callbacks use `EVALUATION_REQUEST_WEBHOOK_URL`.

## RH Chain dependency matrix

| Requested feature | Required dependencies | Behavior if absent |
| --- | --- | --- |
| Admin endpoints | `INFOPUNKS_ADMIN_TOKEN` | Remain closed; public service is degraded. |
| Review console | `RH_CHAIN_REVIEW_CONSOLE_ENABLED`, `RH_CHAIN_REVIEW_ADMIN_TOKEN` | Hidden (404); no credential fallback. |
| Automation / market history / reviewed classifications | `DATABASE_URL` | Feature disabled; critical startup warning. |
| Attention Quality v2 | `DATABASE_URL`, market history | Feature disabled; public feature path returns 503. |
| Project Claims | `DATABASE_URL`, enabled authenticated review console | Feature disabled; public feature path returns 503; internal routes remain hidden. |
| Intelligence Receipts | enabled Project Claims and authenticated review console | Feature disabled; public feature path returns 503. |
| Project Directory | enabled Project Claims and authenticated review console | Feature disabled; public feature path returns 503. |

The structured event is `optional_feature_disabled` with `severity: "critical"`.
It contains feature and reason only, never configuration values.

## Recovering a suspended crash loop

1. In Render, inspect the latest startup JSON and run `npm run verify:runtime-config`
   in a shell if available. Do not paste secrets into logs or tickets.
2. Fix malformed values first (especially booleans: only `true` or `false` are
   accepted). Invalid syntax still intentionally prevents a corrupt startup.
3. Remove or set to `false` any optional RH Chain feature flag whose
   dependencies are not provisioned. Missing optional secrets now produce a
   degraded public service instead of a crash loop.
4. Resume the service or trigger a manual deploy. Confirm `/healthz` before
   enabling anything else.
5. If persistence was unavailable, restore database connectivity and migrations
   outside the application. The service never performs RH Chain migrations at
   startup.

## Safe re-enablement order

1. `DATABASE_URL`, then confirm durable persistence through `/readyz`.
2. `RH_CHAIN_REVIEW_CONSOLE_ENABLED=true` and its dedicated review token.
3. Market history and reviewed classifications.
4. Attention Quality v2.
5. Project Claims.
6. Intelligence Receipts and Project Directory.
7. Automation last, after validating its schedules and instance identifier.

At each step, deploy once, inspect `runtime_configuration_verification`, then
call the relevant authenticated route. Never use a public endpoint to test a
review gate.

## Production smoke verification

```sh
curl -fsS https://radar.infopunks.fun/healthz
curl -fsS https://radar.infopunks.fun/readyz
npm run verify:production
```

`/healthz` is liveness only and does not call Postgres or third-party
providers. `/readyz` reports `healthy`, `degraded`, or `unavailable`; it checks
application and persistence state only and does not depend on catalog, market,
or other third-party providers. A public-only service is expected to be
`degraded` but available. An `unavailable` readiness response is HTTP 503.
