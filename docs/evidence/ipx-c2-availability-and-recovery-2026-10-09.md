# C2 read-only availability diagnosis and recovery preparation

## Observation

The latest check tied to the current lockfile candidate (`f6e2019`) was made on 9 October at 05:08:36–05:08:47 UTC. All five paths listed below returned HTTP 503 with `x-render-routing: suspend`, and all five bodies had SHA-256 `e5805ccce9532a696c4103997ad9e6d34037dfac71e46dd615641cd7869b3956`. Raw responses are under `runs/ipx-f6e2019-2026-10-09/`.

At `2026-10-09 04:51:43 UTC` (`10:21:43 Asia/Colombo`), the public service returned HTTP 503 and `x-render-routing: suspend` for `/health`, `/status`, `/v1/ipx/launch`, and `/v1/ipx/economy/summary`. The four bodies were byte-identical with SHA-256 `e5805ccce9532a696c4103997ad9e6d34037dfac71e46dd615641cd7869b3956`. This supports a suspended-route diagnosis; it does not identify the suspension reason, actor, deployed revision, database state, or underlying service health.

`/v1/radar/benchmark-summary` returned HTTP 429 in the same request burst. Treat that result as rate limited; it does not establish the endpoint's normal behavior. Raw response headers and bodies are under `docs/evidence/runs/ipx-eeee995-2026-10-09/`.

## Access boundary

No Render operator account, deploy/event logs, billing notices, service configuration, or production database read role was available. No service resume, restart, DNS change, secret rotation, deployment, migration or production write was attempted. The precise underlying reason for suspension and deployed code revision remain unknown.

## Recovery runbook for an authorized operator

1. In the hosting console, record service ID, suspension state/reason, deploy event history, billing notices, configured commit, runtime, environment variable names (not values), health-check path and database attachment. Export the relevant read-only logs and timestamps.
2. Compare the configured deployment SHA with the frozen candidate `eeee995e964240e6ef2c659f18c83875c140a221`. Do not point production at that candidate until G0–G6 policy, security, legal, route and operator approvals are complete.
3. Confirm database identity and availability through the authorized read role. Capture applied migration ledger, app-role grants, immutable trigger/index state and backup identifier. Keep migration and application roles separate; verify the application role is not owner or superuser.
4. If an operator separately authorizes recovery, restore service availability without changing the release revision first. Probe `/healthz` and `/readyz`, then the five public endpoints individually at a controlled rate. Record status, date, response hash, route headers and deployed revision. A healthy router response alone does not prove database readiness or economic operation.
5. Before any later promotion, take and verify a fresh backup, rehearse reviewed additive migrations on a restored staging copy, and run receipt replay/recovery tests under the restricted application role. Roll application code back to the prior healthy revision if needed; retain append-only receipt, acceptance, attempt, quarantine and economic rows. Reconcile any target-only writes before a database restore.

## Status

C2 is partially complete: the public response is recorded and the operator runbook is prepared. Root-cause confirmation, service recovery, deployed-revision proof and database inspection are BLOCKED on authorized hosting and database access. G5 remains BLOCKED.
