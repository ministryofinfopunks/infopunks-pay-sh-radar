# IPX C-track infrastructure discovery — 8 October 2026

## Scope and authority

This is a read-only discovery and local parity preparation on the clean `codex/ipx-c1-parity` branch at `1c06aa286626cf12287de4e2842e359c78828e9d`. It is **not** final C1 evidence: all checks must be rerun against the exact frozen integration SHA. The disposable database is local. No production database, deployment, secrets, role, signer, facilitator, contract, venue, or funds were changed.

## C1 preliminary parity

| Check | Result at this SHA | Boundary |
| --- | --- | --- |
| Node / npm / Forge / PostgreSQL | Node 25.6.1; npm 11.9.0; Forge 1.5.1; PostgreSQL 14.20 | Toolchain versions recorded; production versions unknown. |
| `npm run typecheck` and `npm run lint` | PASS | Clean source at this SHA. |
| `npm run build` | PASS | Vite reports a large chunk warning; no build failure. |
| `forge test` | PASS: 6 tests, 0 failures, 0 skipped | Source/unit proof only, no deployed-bytecode proof. |
| `git diff --check` | PASS | Locale fallback warning only. |
| Full application suite with disposable PostgreSQL | First unconstrained run: 239 files passed, 21 failed, 1 skipped; 1,837 tests passed, 37 failed, 2 skipped. Most failures were five-second timeouts under concurrent load. A constrained rerun is required before a parity verdict. | No production durability claim. |

Migration source SHA-256 at this SHA: `011` up `78759614ada801c801920410d5010f6fcb6ec1c563a1974cba836ea3c8ba551f`; `014` up `d6f033ee13d73b36477c080d3b38cc6c343cf5bf8f5c64a00373ee2573afbec3`; `017` up `77583eea4504ce611737f8f73f94172309229378bceefb21068752ee07e6f364`. Migration 018 also exists on this branch and must be included in the final candidate inventory, with any later A3–A5 migrations.

`scripts/rh-chain-migration-status.ts` uses the external-only inventory in `src/services/rhChainProductionReadiness.ts`. That inventory checks canonical migration 011 and RH accounting 016, but does **not** cover 014, 017, or 018. Its green result alone cannot attest IPX schema parity. The final operator inspection must additionally record those migration files' checksums, the exact applied migration ledger, constraints, immutable triggers, indexes, and receipt row counts in the target. Migration 011 and 017 create tables/functions/triggers; 014 replaces historical evaluation policy constraints. The SQL files do not themselves establish the deployed application role's privileges. Query the actual application role's grants and verify it is neither table owner nor superuser before production promotion. A disposable local superuser test does not substitute for this.

## C2 read-only availability diagnosis

At 2026-10-08 09:50 UTC, `GET https://radar.infopunks.fun/` returned HTTP 503 with `x-render-routing: suspend`, `cf-cache-status: DYNAMIC`, and `server: cloudflare`. This is consistent with a suspended Render route, but the header alone does not identify who suspended it or why. The earlier repository production read at 04:01 UTC also recorded 503 for `/health`, `/status`, `/v1/ipx/launch`, `/v1/ipx/economy/summary`, and `/v1/radar/benchmark-summary`. Obtain Render service status, deploy events, billing/suspension notices, and routing logs from an authorized operator. Once resumed, first verify `/healthz` and `/readyz`, then public API shapes, migration state, catalog freshness, and payment/facilitator readiness. No DNS switch, restart, service resume, or deployment was attempted here.

## Remaining C-track dependency register

| Package | Evidence needed | Current status |
| --- | --- | --- |
| C1 | Repeat all parity checks at frozen SHA; full disposable PostgreSQL suite with skips and versions; compare migrations and production application role. | Preliminary only. |
| C2 | Operator diagnosis of the 503 and a read-only service-status/log capture; verified recovery procedure. | BLOCKED on Render operator access. |
| C3 | Authorized staging clone; apply reviewed additive migrations in order; app-role permissions; restart/replay, reconciliation, outage, backup/restore and rollback rehearsal with receipt count/hash comparison. | BLOCKED on staging access and frozen candidate. |
| C4 | Finalized canonical IPX/PLTR asset IDs, bytecode and constructor proof, funded route/pool/router and facilitator capability at an identified deployment. | BLOCKED on reviewed assets, venue and deployment evidence. |
| C5 | Bounded read-only market and Solana sample with time/block provenance, freshness, coverage and dashboard reconciliation. | Preparation only; canonical addresses and access needed. |
| C6 | Operator-gated bounded live economic chain after approved policy, security/legal review, funded venue, production-role and recovery evidence. Capture paid judgment, settlement, revenue, contribution, purchase and burn receipts against one deployment. | BLOCKED on G0–G5 approvals, production authorization and live resources. No local simulation clears C6. |

## Deployment and rollback preparation

Use `docs/render-production-runbook.md` and `docs/rh4663-production-runbook.md` for existing host and role procedure. Before promotion, pin the candidate SHA, migration checksums and policy hash; snapshot/verify backup and target; apply only reviewed additive `.up.sql` migrations under the authorized migration role; verify the restricted application role; and run route/readiness plus receipt replay checks. On application failure, restore prior traffic/code while retaining append-only canonical and IPX records. Reconcile target-only writes. Do not run destructive down migrations or delete receipts as an application rollback. Record operator, time, deployment ID, target database identifier, backup identifier and rollback decision in the final evidence manifest.
