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

## Production PostgreSQL restoration gate

This section is the guarded runbook for reconnecting the existing Render
PostgreSQL database to `radar.infopunks.fun`. It is documentation for human
operators only. Do not connect to production automatically, do not alter Render
environment variables from this repository, do not run migrations from
application startup, do not rerun `20260719_001`, and do not apply
`20260814_009` during initial restoration.

The existing production database is not empty. Live schema inspection confirmed
that it already contains Pay.sh Radar, Solana Radar, and Robinhood Chain data,
with this migration state:

| Migration | Production state |
| --- | --- |
| `20260719_001` | APPLIED |
| `20260719_002` | ABSENT |
| `20260719_003` | ABSENT |
| `20260719_004` | ABSENT |
| `20260719_005` | ABSENT |
| `20260720_006` | ABSENT |
| `20260813_007` | ABSENT |
| `20260813_008` | ABSENT |
| `20260814_009` | ABSENT |

### Required gated sequence

```text
A. Deploy the resilience code with `DATABASE_URL` absent.
B. Verify memory-mode production stability.
C. Create or confirm a recoverable production database backup.
D. Apply `20260719_002`.
E. Verify.
F. Apply `20260719_003`.
G. Verify.
H. Apply `20260719_004`.
I. Verify.
J. Apply `20260719_005`.
K. Verify.
L. Apply `20260720_006`.
M. Verify complete pre-4663 RH schema.
N. Configure production `DATABASE_URL` using the Render PostgreSQL internal URL.
O. Set `DATABASE_POOL_MAX=2`.
P. Keep all recurring jobs disabled.
Q. Redeploy.
R. Verify DB-backed persistence and no restart loop.
S. Observe a stable web + Postgres period.
T. Only then consider `20260813_007`.
```

### First reconnection environment

At the first DB-backed web deploy, keep the environment narrow:

```text
DATABASE_POOL_MAX=2

INGESTION_ENABLED=false
MONITOR_ENABLED=false
RH_CHAIN_AUTOMATION_ENABLED=false

RH_4663_PHASE2_ENABLED=false

RH_4663_PHASE3_ENABLED=false
RH_4663_PHASE3_INGESTION_ENABLED=false
RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED=false
RH_4663_PHASE3_PUBLICATION_ENABLED=false
RH_4663_AUTO_PUBLICATION_ENABLED=false
RH_4663_EXTERNAL_DISTRIBUTION_ENABLED=false
RH_4663_PHASE3_SHADOW_MODE=true
RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=false
```

Use the Render PostgreSQL internal URL for `DATABASE_URL`; never record the
value in docs, source, tickets, screenshots, or logs.

### Migration guardrails for 002-006

Run these commands only from an operator-controlled environment that can reach
the Render internal PostgreSQL database, such as a temporary Render shell/job on
the same private network. They are not application startup commands and are not
part of a web-service deploy.

Set `DATABASE_URL` in the shell from the Render internal PostgreSQL URL without
printing it. Stop immediately on the first error. Do not apply a later
migration as a speculative fix.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_002_rh_chain_reviewed_classifications.up.sql
```

Verify, then:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_003_rh_chain_classification_layer_vocabulary.up.sql
```

Verify, then:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_004_rh_chain_attention_quality_receipts.up.sql
```

Verify, then:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_005_rh_chain_project_claims.up.sql
```

Verify, then:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260720_006_rh_chain_reviewer_workflow.up.sql
```

Stop after `20260720_006`. Do not include `20260813_007`,
`20260813_008`, or `20260814_009` in the initial reconnection batch.

### Schema verification after 002-006

Use read-only SQL after each migration and after `20260720_006`. The final
pre-4663 schema check must show no missing tables, no missing indexes, and the
classification constraint must include `consumer`.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
with expected(table_name) as (
  values
    ('rh_chain_reviewed_classifications'),
    ('rh_chain_reviewed_classification_audit'),
    ('rh_chain_attention_receipts'),
    ('rh_chain_projects'),
    ('rh_chain_project_claims'),
    ('rh_chain_project_evidence'),
    ('rh_chain_project_observations'),
    ('rh_chain_project_verdicts'),
    ('rh_chain_intelligence_receipts'),
    ('rh_chain_project_audit'),
    ('rh_chain_project_contract_relationships')
)
select e.table_name,
       case when n.oid is null then 'missing' else 'present' end as status
from expected e
left join pg_class c
  on c.relname = e.table_name
 and c.relkind = 'r'
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by e.table_name;"
```

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
select conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'rh_chain_reviewed_classifications_primary_layer_check';"
```

The returned constraint definition must include `consumer`.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
with expected(index_name) as (
  values
    ('rh_chain_reviewed_classifications_status_updated_idx'),
    ('rh_chain_reviewed_classifications_approved_effective_idx'),
    ('rh_chain_reviewed_classification_audit_contract_time_idx'),
    ('rh_chain_attention_receipts_contract_created_idx'),
    ('rh_chain_attention_receipts_status_idx'),
    ('rh_chain_projects_slug_idx'),
    ('rh_chain_projects_review_idx'),
    ('rh_chain_project_claims_project_idx'),
    ('rh_chain_project_evidence_project_idx'),
    ('rh_chain_project_observations_project_idx'),
    ('rh_chain_project_verdicts_project_idx'),
    ('rh_chain_intelligence_receipts_project_idx'),
    ('rh_chain_intelligence_receipts_integrity_hash_idx'),
    ('rh_chain_project_audit_project_idx'),
    ('rh_chain_project_contract_relationships_project_idx'),
    ('rh_chain_project_contract_relationships_contract_idx'),
    ('rh_chain_project_contract_relationships_active_contract_idx'),
    ('rh_chain_project_contract_relationships_active_primary_idx')
)
select e.index_name,
       case when n.oid is null then 'missing' else 'present' end as status
from expected e
left join pg_class c
  on c.relname = e.index_name
 and c.relkind = 'i'
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by e.index_name;"
```

### First reconnection verification

After configuring `DATABASE_URL`, `DATABASE_POOL_MAX=2`, and the disabled-job
flags, redeploy once and verify these public surfaces:

```sh
curl -fsS https://radar.infopunks.fun/healthz
curl -fsS https://radar.infopunks.fun/readyz
curl -fsS https://radar.infopunks.fun/status
curl -fsS https://radar.infopunks.fun/
curl -fsS https://radar.infopunks.fun/solana
curl -fsS https://radar.infopunks.fun/4663
curl -fsS https://radar.infopunks.fun/4663/pulse
curl -fsS https://radar.infopunks.fun/4663/today
curl -fsS https://radar.infopunks.fun/4663/signals
curl -fsS https://radar.infopunks.fun/4663/receipts
curl -fsS https://radar.infopunks.fun/rh-chain-signal-desk
RADAR_VERIFY_BASE_URL=https://radar.infopunks.fun npm run verify:production
SMOKE_BASE_URL=https://radar.infopunks.fun npm run smoke:production
```

Confirm from responses and Render logs:

- Process remains stable with no restart loop.
- `/healthz` is live.
- `/readyz` reports `persistence`/`dbMode` as Postgres and database reachable.
- No `database_circuit_opened` loop or repeated recovery failures.
- All recurring jobs are still off.
- Existing Pay.sh Radar, Solana Radar, and RH Chain public surfaces have not
  regressed.

### Failure during reconnection

If attaching `DATABASE_URL` causes a process crash, restart loop, pool
exhaustion, DB connection storm, or existing Solana/Radar regression:

1. Disable or remove `DATABASE_URL`.
2. Redeploy the known-good memory-mode web service.
3. Leave the database untouched.
4. Preserve Render application logs and PostgreSQL logs.
5. Investigate before retrying.

Do not apply additional migrations as a speculative fix. The containment action
is returning the web process to memory mode while preserving the database.

### Post-reconnection observation

Require a deliberate observation period with only web + Postgres enabled before
any recurring job is enabled. Track:

- process restarts;
- PostgreSQL connection count;
- pool waiting count when available in runtime diagnostics;
- database failure events;
- `database_circuit_opened` events;
- recovery probe and `database_recovered` events;
- request latency;
- `/healthz`;
- `/readyz`.

### Later recurring-job reactivation

Only after stable DB-backed web operation, enable one recurring job at a time:

```text
INGESTION_ENABLED
↓
observe

MONITOR_ENABLED
↓
observe

RH_CHAIN_AUTOMATION_ENABLED
↓
observe
```

Do not enable all three together. If `20260813_007` or `20260813_008` protocol
work is prioritized first, keep these legacy jobs off until the complete Phase 2
proof run is done.

### //4663 Phase 2 to 009 gate

Do not apply `20260814_009` before the complete Phase 2 proof. The later
protocol gate is:

```text
20260813_007
↓
controlled real CALL
↓
verify persistent IP-CALL
↓
verify Genesis
↓
verify duplicate rejection
↓
restart/redeploy
↓
prove CALL survives
↓
20260813_008
↓
resolution signer
↓
controlled resolution
↓
IP-RES
↓
Merkle proof
↓
real Chain 4663 anchor
↓
RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED=true
↓
20260814_009
↓
Phase 3.1 shadow ingestion
```

See `docs/infopunks-4663-close-the-loop-rollout.md` and
`docs/infopunks-4663-make-the-chain-speak-rollout.md` for the detailed protocol
runbooks. `20260814_009` remains forbidden before the Phase 2 proof is complete.

## Safe re-enablement order

1. `DATABASE_URL` with `DATABASE_POOL_MAX=2`, then confirm durable persistence
   through `/readyz` while all recurring jobs remain disabled.
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
