# Unified Radar system qualification

Source freeze: **d6112b5c8c56e75a8b33c238126a478277b3d0a1**, branch `codex/unified-radar`. Parent baseline: `60e3fd0` (reviewed Track A Linux qualification successor). Evidence-only commits may follow; application, migrations, tests, lockfile and qualification scripts must remain byte-identical to this source freeze. No branches were merged, pushed or deployed.

Qualification date: 2026-10-12 (Asia/Colombo). Scope: local macOS arm64, Node 24.21.0/npm 11.9.0, PostgreSQL 14.20, isolated disposable localhost databases. Payment facilitators, external execution and evaluation artifacts in tests are explicitly synthetic/mocked. No local result establishes external outcome truth, real settlement, independently attested Evaluation, staging operation or production readiness.

## Gate matrix

The machine-readable [check results](unified-radar/system/check-results.json), [full test summary](unified-radar/system/full-test-summary.json), migration JSON and recovery records bind to the source above. Raw logs are retained in `output/unified-radar/final-logs` and are reproducible using `scripts/qualify-unified-radar-local.py --node-bin <qualified-node-directory>`. The runner strips inherited token/key/database bindings, creates uniquely named localhost databases and never targets an existing deployment.

| Gate | Result / interpretation | Evidence |
|---|---|---|
| Typecheck | PASS; TypeScript strict checking | `system/check-results.json`, raw `typecheck.log` |
| Lint | PASS; repository lint is tsc; no separate ESLint gate is claimed | raw `lint.log` |
| Production build | PASS; compiled API + Vite static build, explicit NODE_ENV=production; large Radar chunk warning retained | raw `build.log` |
| Full tests | PASS: **277 files, 1,976 tests, zero failures/skips**; includes UI, authority, PostgreSQL, resilience and recovery negative paths | `system/full-test-summary.json` |
| Judgment domain | Same canonical authority; legacy hashes unchanged; typed policy/reference/network/expiry binding; unsupported rails and policies fail closed | `tests/judgment-domain.test.ts`, `tests/unit/judgment-service.test.ts` |
| Typed persistence | Namespaced typed request, v2 context and paid receipt replay survive a reconstructed PostgreSQL adapter with one mocked settlement | `tests/judgment-domain.test.ts` durable case |
| Payment/idempotency | Claim uniqueness, same-key replay/conflict, quote expiry, uncertain settlement, restart recovery, invalid signatures and duplicate prevention | `tests/unit/x402-judgment.test.ts`, `tests/integration/judgment-payment-durability.test.ts` |
| Canonical receipts | Integrity, immutable ancestry, issuer verification, future-time quarantine, accepted-history boundaries, frozen context and bounded causal replay | authority/spine/context/causal suites in full summary |
| Evaluation/reputation | Eligible external execution/classified accepted history tested synthetically; production Evaluation and score authority remain closed | score-authority, controlled-staging, execution-score-eligibility suites |
| Authorization/privacy | Operator-only canonical proof/context/attempt/tape/witness/accounting; uniform unauthenticated denial before lookup, including encoded static paths; private no-store; qualified results and payment signatures gated | `tests/security/private-proof-reads.test.ts`, HTTP payment suites |
| Legacy intake | Production receipt/claim/challenge/validation publication/durability unavailable even for admin; synthetic legacy seeds disabled | `tests/health-readiness.test.ts`, private-proof and legacy lockdown suites |
| Migration inventory | PASS; no new migration; all historical 001–022 source bytes unchanged from selected baseline | `npm run migrations:validate`, empty migration diff |
| Migration ordering/checksums | PASS; fresh apply → validate → repeat of all 22 migrations; runner tests include drift/unknown history/failed DDL/concurrency/adoption refusal | `system/migration-first.json`, `migration-check.json`, `migration-repeat.json` |
| PostgreSQL durability | Canonical receipts/journal/issuer/context/acceptance, engine memory and uniqueness exercised on disposable local PostgreSQL | full durability tests; no skipped external DB suites permitted in final pass |
| Backup/restore | PASS; pg_dump/pg_restore into a separately created local DB; exact receipt digest, signature/ancestry, projection/hash and causal manifest match; 22 ledger rows | `system/recovery-before.json`, `recovery-after.json` |
| Health/readiness | Production mandatory DB/schema/catalog/config failures return unavailable while liveness remains live; local development readiness may report 200/degraded and is not staging readiness | health/resilience tests, `local-readiness.json` |
| Provider/outage/staleness | Existing catalog freshness, fixture refusal, bounded provider timeouts, RPC failure and PostgreSQL failure matrix retained; browser error/timeout recovery tested | resilience/production readiness suites, browser failure-recovery JSON |
| Dependency audit | Production: 0 findings. All dependencies: 1 low development-only esbuild Windows advisory; no high/critical finding. | `system/audit-production.json`, `audit-all.json` |
| Browser/accessibility | Real compiled application, 11 routes × 3 viewports, actual free check plus explicit injected error/timeout scenarios | UI qualification packet |
| Diff/change control | Original main checkout unchanged; no production environment, signing key, live payment or token operation changed | source diff; final git checks |

## Security and authority decisions

PR #6 was independently read via the GitHub connector: open/draft/unmerged at `11bbaa4`, with an explicit public tenant exposure hold. Its public Decision View is not incorporated. Fresh remote-head reads match main `dfe089b`, Track A release `f6b5de6`, Phase 6B.1 `d0d6081` and PR #6 `11bbaa4`; the local successor `60e3fd0` remains the narrowly reviewed baseline. E1 reviewer branches are independently gated and conflict with historical migration 018. No branch name or test pass was treated as feature approval.

The inherited canonical raw-read exposure is closed here. Authentication uses the existing constant-time operator comparison; this is **not** general tenant identity/ownership support. Canonical paid production capability requires operator authority, and anonymous qualified results/receipts are denied. General customer/tenant paid access and public canonical publication remain unavailable pending a separately reviewed identity/ownership/publication policy. Public research projections continue under their existing sanitization/publication policies. The browser does not collect bearer secrets, sign transactions or automatically pay a 402.

Production Evaluation and derived-score HTTP authority remain unavailable pending independent E1 qualification; admin credentials cannot bypass that gate. Historical commitments replay unchanged. No RH market reputation is synthesized from service-delivery scores. Internal imported receipts retain their existing reviewed-operator/eligibility semantics; only the dedicated proof verifier can qualify external execution for scoring. In-process/synthetic receipt chains are never external truth.

## Chain coverage and execution boundaries

| Domain | Implemented boundary | Qualified here | Still blocked |
|---|---|---|---|
| Solana service route | Strict namespace and policy admission; reviewed server evidence binding; budget/service method/intent/identity/freshness/confidence gates; canonical frozen Judgment | Synthetic positive/negative, HTTP adapter mapping, memory/Postgres replay, actual local free browser check | Reviewed live observations, live fee rail and tenant-bound production access |
| Provider/machine endpoint | Registry representation | Unsupported v1 policy abstention | Independent policy adapter qualification |
| Robinhood Chain markets/contracts | Typed registry plus stored PLTR market-state adapter preserving identity, pool/quote/depth/basis/freshness/gaps | Read-only inspection and free canonical abstention; no payment or trade permission | Reviewed action policy, independent historical evaluations, real RPC/source qualification |
| Settlement | Existing Base USDC/RH USDG gated code; requested fee network separated from subject and service method | Mocked payment/negative/replay tests | Real facilitator, merchant, asset/finality/RPC and operational review |
| Native Solana fee rail | Unsupported | Explicit abstention | No implementation/verification supplied |
| IPX/PLTR operations | Existing inert modules preserved | No activation performed | Out of scope |

## Performance and telemetry

Final build sizes and Lighthouse measurements are recorded in the UI packet. The landing makes no data request before rendering and retains lazy deep-route loading. Spend Terminal has its own chunk; heavy RH pages retain existing lazy boundaries. The oversized Radar JS/CSS bundle remains a material deep-route performance limitation, not hidden by a warning threshold change.

Local memory/PostgreSQL hot-path results are in `system/phase2-judgment-performance.json` and `phase2-judgment-postgres-performance.json`. These use mocked external settlement and are **not** end-to-end production latency. `api-observability.json` summarizes actual local app request events; `test-observability.json` is explicitly a synthetic-test instrumentation sample. Optional database timing logs omit SQL/parameters/URLs and expose latency only. The log summarizer is bounded to the last 10,000 observations per latency metric and reports p50/p95/p99, counts, freshness and known rejection/payment-stage events. Missing telemetry remains unknown.

Existing provider/catalog health, RPC/source errors, receipt/context replay and evaluation eligibility checks remain separate authoritative sources. No cross-replica telemetry/alert collector, real RPC/payment/Evaluation baseline, representative load/capacity report or proposed production SLO is asserted. Set proposed SLOs after representative staging measurements.

## Staging decision: HOLD

Local qualification prepares a reviewable candidate. It does not clear the inherited release HOLD or authorize any operator deployment. Required blockers:

1. Review the exact source diff, authorization compatibility changes and existing applied migration checksums. Do not merge PR #6, E1 migration collisions or unrelated IPX branches.
2. Qualify the exact Linux container/image digest, runtime and container scan. Docker is unavailable on this host; macOS compilation is not Linux parity.
3. Supply an approved isolated Railway staging environment, private PostgreSQL, separate migration/runtime roles, restricted origin/ingress and a fresh staging-only operator binding. No such environment was supplied or accessed.
4. Verify live approved catalog freshness without fixture fallback, production readiness 503 on mandatory outages, controlled-staging mutation/payment rejection and an edge request limiter. App limits are process-local; keep one replica until replica-wide enforcement is qualified. Preserve Fastify's conservative proxy trust.
5. Assign rollback, backup/restore and alert owners; rehearse restore into a new staging DB, failure monitoring and rollback without rewriting receipt history. Retain append-only migrations and use reviewed forward fixes rather than destructive down migrations.
6. Keep financial, execution, publication, model and IPX/PLTR activation flags false. Independent E1, public tenant publication, RH trade policy and real settlement remain separate release gates.

Use the inherited `deployment/railway-staging-manifest.json` and `docs/evidence/track-a/staging-rc-20261011/railway-staging-runbook.md` as reviewed direction, with this source SHA and added private-read/intake boundaries. Enable `RADAR_QUERY_TIMING_ENABLED=true` only through a reviewed environment change when query baselines are needed. This task made no staging/production configuration change.

Adversarial path verification found an encoded-route guard bypass in the local candidate before release. `d6112b5` binds authorization and private caching to Fastify matched-route metadata as well as raw family paths, and binds production legacy-write refusal to matched routes. Encoded canonical/accounting reads and encoded receipt/claim/validation writes now have regression coverage. [Before/after probes](unified-radar/private-path-normalization.json) record the real local HTTP outcomes; unrecognized routing variants remain 404 and never reach canonical storage. This finding was not deployed.

Final subset counts from the same complete source-bound run (overlapping categories, not additional independent test totals): frontend 62 files / 364 tests; integration/PostgreSQL 21 / 67; security 4 / 61; Judgment/context/receipt/causal eligibility 19 / 144. All passed; no skipped PostgreSQL suites. The Node/Vite future-config-loader and Fastify deprecation warnings are retained as tooling limitations; the large chunk warning remains active. See the current staging runbook for the concrete handoff.
