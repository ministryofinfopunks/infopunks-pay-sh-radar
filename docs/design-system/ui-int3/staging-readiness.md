# Isolated staging preparation — HOLD; no deployment authorized

Deployment subject is e0315314264fff395f8e84b37bb6f1984d6b39e7. UI-INT3 commits add QA/evidence only; do not silently deploy the evidence branch as a different candidate. The existing render.yaml declares radar.infopunks.fun and production secret bindings: it is not an isolated staging manifest and must not be applied for this task.

## Prerequisites

| Requirement | Current verification / remaining action |
| --- | --- |
| Independent security | HOLD; security-review.md and exact-SHA written approval needed |
| Independent migration | HOLD; migration-review.md plus operational DB-role/upgrade/restore approval |
| Human accessibility/mobile | HOLD; manual-qualification.md and real device/operator acceptance |
| Solana baseline | HOLD; corrected bounded-tile candidates require scoped human approval |
| Candidate | Full e031531 SHA verified; evidence-only d3d0a44 descendant; runtime equalities in evidence/freeze.json |
| Migration compatibility | Local PostgreSQL16.15 clean/repeat/concurrent/017/020 upgrade/backup/replay PASS; actual staging ledger uninspected |
| Linux/container CI | HOLD; GitHub reports candidate SHA absent (422); no associated runs/checks. Docker daemon unavailable locally. Secure baseline CI does not certify this candidate. |
| Staging service | HOLD; isolated service/account/name/domain/network/TLS/operator not supplied; bind reviewed artifact digest, non-root image and Node24 runtime |
| Tenant test identities | Plan tenantA/agentA, tenantA/agentOther, tenantB/agentB, expired/revoked identity; distinct staging-only high-entropy keys supplied by operator, digests bound server-side; no production key reuse |
| Auth/proof policy | Retained fail-closed owner/operator policies; controlled staging write gate; actual proxy/CORS/TLS/caching still requires inspection |
| Observability | Existing request completion/timing, persistence failure classification/redaction and health endpoints; staging log sink/retention/access/alerts not provisioned |
| Rollback | Procedure below prepared; compatible prior artifact, operator and rollback authorization not supplied |
| Backup/restore | Local test restoration PASS; actual staging backup retention/RPO/RTO/restore-role drill pending |

## Configuration contract to review before provisioning

Use the unchanged Dockerfile's pinned Node24 Debian base and non-root `USER node`; generate dependency and container OS SBOMs and bind image digest to exact candidate. Require `NODE_ENV=production` and `RADAR_CONTROLLED_STAGING=true`. [staging-config.env.example](staging-config.env.example) is a non-executable review template, not a validated deployed service. It explicitly disables the capabilities in src/config/controlledStaging.ts and leaves forbidden bindings absent. Operator must add isolated DATABASE_URL, fresh tenant credential digests, separate admin token, frontend origin, approved catalog source and minimal network reachability through secure secret management. Do not commit credentials or map the production domain. Never bypass TLS warnings or broadly trust proxy headers. Current Fastify construction does not enable trustProxy; review actual proxy/rate-limiter behavior and aggregate capacity.

Run `npm run verify:runtime-config` and reviewed migration apply/validate commands against the staging-only database only after authorization. Confirm configured flags via safe redacted output; no payment-signature headers, issuer/execution signing secrets, production wallets or live facilitator bindings. Controlled staging rejects writes except bounded `/v1/pre-spend/check` and `/v1/decide` free-assessment journals. It also forbids issuer/reviewer-key bindings and independent evaluation authority. Consequently signed verification/issuance and evaluation mutation may be intentionally unavailable. Seed read-only synthetic records offline through a separately reviewed operator procedure, test their displayed provenance, and expect fail-closed verification/mutation where authority is absent. Do not load forbidden keys, disable the staging gate or claim successful evaluation just to make a journey green. Any expanded synthetic signing/evaluation test scope needs explicit security review and separate authorization/environment.

## Staging test plan after approval

| Journey | Required observed result |
| --- | --- |
| Homepage | Approved cyan terminal, correct no-check/no-receipt state; field deep links to current Spend controller; mobile navigation |
| Solana Radar | Frozen completed-data visual cases and live test-data load/outage cases; no placeholder declared complete; complete bounded-tile/footer coverage |
| Spend/route/provider | Labels, filters, sort and evidence; canonical decision response; insufficient evidence free; unsupported intent rejects safely; no execution authority |
| Judgment API | Auth/strict validation/idempotency/replay/conflict/timeout/429/503 and redaction; free bounded journal only; reject payment-signature challenge/settlement |
| Private proof | Owner accessible where seeded; tenantB and same-tenant wrong agent denied; missing/invalid/expired/revoked keys; no stale UI record; no-store and no credentials in URL/log/cache |
| Public proof | Only reviewed projection; raw receipts/tape/attempts/export/decision reads never leak tenant data; unknown/encoded routes fail closed |
| Evaluation | Seeded fixture inspection truthful; attempted mutation/score projection rejected under controlled staging; 'review unavailable' remains unavailable |
| Robinhood | Read-only market views, stale/unavailable labels, no anonymous private history calls and no trade/wallet side effect |
| Outage | Stop/restart only isolated API/DB with operator; redacted error, preserved inputs, safe retry without duplicate journal/payment/receipt |
| Mobile | Human iOS/Android navigation, touch, virtual keyboard, proof details, orientation/text scaling/reduced motion with real-device records |

Use fresh non-production accounts and synthetic fixtures only. Evidence records actual artifact digest, app SHA, service config digest (redacted), DB ledger/checksums, account labels, browser/device, timestamps, expected/observed results, request IDs and log/screenshot hashes. No live-value payments or production signing keys.

## Backup, rollback and restoration

1. Before authorized apply, quiesce the isolated test service, verify DB identity/ledger and app/image hashes, create an encrypted restricted backup with `pg_dump --format=custom --no-owner` using operator-managed credentials. Record checksum and approved retention/RPO/RTO. Keep secrets out of command/log evidence.
2. Restore into a newly named isolated database with `pg_restore --no-owner`, validate all22 ledger entries/checksums, schema constraints, tenant denial and immutable receipt triggers. Run the reviewed synthetic cryptographic receipt/projection/tape replay against that restored DB and compare hashes/counts. Test actual non-owner restore/runtime roles; local superuser results are insufficient.
3. Application rollback: stop new traffic and use an explicitly approved previous image compatible with the unchanged001–022 schema. Do not automatically run down migrations or delete canonical receipts. Preserve logs, backup and error evidence.
4. If DB recovery is required, restore to a fresh DB and validate first; operator explicitly approves cutover to the restored instance. Preserve original DB for investigation, revoke test credentials on teardown and delete only authorized disposable data after evidence retention.

## Authorization boundary

G8 remains HOLD until every prerequisite above is satisfied and operational configuration is reviewed. G9 remains HOLD until an explicit authorized operator names the isolated service, exact SHA/image digest, DB, disabled capabilities, allowed synthetic actions, time window, rollback authority and stop conditions. No formal staging authorization is requested yet because prerequisites are open. No service was provisioned or deployed, no PR/remote branch was mutated, and no merge/release occurred.
