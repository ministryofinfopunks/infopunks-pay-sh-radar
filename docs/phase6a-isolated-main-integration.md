# Phase 6A: isolated main integration

Prepared 2026-10-09, Asia/Colombo. Phase 6A PASS. Safe to begin isolated staging preparation: YES. Production deployment and paid operation remain gated separately.

## Integration baseline and scope

Local main and the existing origin/main reference both resolved to `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` when inspected. No fetch was performed; this is a local-reference snapshot. Phase 5 is `1a1295c4117325f63b45dc068e52b269f7d5cb5c`, parent `e5d009f6943339f235f329443af500d2e77425dd`. Main/Phase 5 historical merge base is `55f05d6f6ac46603072662c91cb02d09ba879870`.

The isolated worktree is `/Users/ahdilm/.codex/worktrees/radar-phase6-integration/Infopunks Pay.sh Intelligence Terminal`, branch `codex/radar-phase6-integration`, based directly on local main. Existing worktrees and staged/unstaged state were inventoried in ignored `output/phase6a/baseline.json`. Main and all other checkouts were left untouched.

Only the single validated Phase 5 commit patch was applied, without committing until validation. No historical branch merge or blanket conflict resolution was used. The patch applied without textual conflicts. Main and Phase 4 application source are identical; main also has two IPX baseline documents, both preserved. All 13 Phase 5 files match their validated checkpoint blobs. The other 976 main files remained unchanged during integration review, including all 34 SQL migration files. Two integration test files and this report were added.

The overlapping API entry point retains main's route handlers, authentication, economic-engine registration, RH USDG metadata validation, issuer trust and settlement verifier precedence. Phase 5 adds a read-only evaluation-chain route and a programmatic optional clock passed to the three existing services. Production startup supplies no clock/gateway/verifier override. The new route has a distinct path length from the generic receipt route. Successful Fastify startup and handler tests verify no duplicate route/schema registration. Existing pre-spend and decide aliases share one handler, limiter and payment service; payment verification was not registered twice. Existing response envelopes remain unchanged.

## Validation evidence

| Gate | Result |
| --- | --- |
| Typecheck and lint | PASS |
| Full test suite | 1,891 passed; zero failed/skipped; 265 files |
| Focused integration/security suite | 164 passed; zero failed/skipped |
| PostgreSQL durability/recovery subset | 43 passed; zero failed/skipped across 10 files |
| New migration matrix | Four cases passed |
| New route/security checks | Four tests passed |
| Closed-loop HTTP proof | PASS, including 21 rejected attempts with unchanged authoritative state |
| Authority audit | A=9, B=1, C=57, D=21, E=11, F=0 |
| Production build | PASS |
| Staged and unstaged diff checks | PASS |
| Isolated internal judgment p95 | 20.30 ms, below 100 ms |

The loop uses actual application HTTP handlers, a private loopback PostgreSQL instance and deterministic external local adapters. It reproduced `proceed → execution proof → contradicted → -15 → do_not_spend` using fresh sufficient observations, `score-policy.v1`, authoritative EvaluationService and receipt-derived history. No reputation override was used. It verified all four hashes and parent links, replayed score projection after application restart, and checked append-only UPDATE/DELETE/TRUNCATE rejection. Paid judgments were created only after local cryptographic facilitator verification. Missing/invalid/replayed payment, wrong settlement, ancestry/substitution, evaluator/delta authoring, stale/insufficient evidence, legacy reputation and idempotency negatives passed.

All evidence is LOCAL. The HTTP scenario uses the official x402 gateway through a cryptographically verifying loopback Base facilitator and synthetic finalized token-transfer RPC. Main's runtime still requires RH USDG `eip155:4663` for new production paid judgments. Separate existing RH USDG accounting tests also passed against local fixtures. No live Pay.sh transaction, testnet transaction or production settlement was performed.

Performance used the existing isolated PostgreSQL service benchmark: 300 measured samples, 30 warmups and 100 historical authoritative evaluations, without competing test/compiler workloads. Judgment local time includes observation lookup, verified score projection, policy, journal and receipt persistence; external payment time is subtracted. The benchmark's facilitator is an in-process deterministic fixture, its judgments are unsigned fixtures, and its schema is the existing 011–014 benchmark schema. The full 001–017 application HTTP integration is verified separately. Thus 20.30 ms proves the existing internal target, not production signed-judgment, HTTP end-to-end or live facilitator latency. PostgreSQL was Homebrew 14.20; Linux deployment-image parity remains a staging preparation gate.

Machine-readable evidence is in ignored `output/phase6a/`: `validation.json`, full/focused test JSON, `postgres-durability-summary.json`, `migration-compatibility.json`, `source-equivalence.json`, `security-review.json`, `performance.json` and query plans. The full redacted request/response sequence is `output/phase5/scenario.json`. `output/phase6a/completion-report.json` records the final integration SHA and file hashes after checkpointing. Generated evidence, runtime data, dependencies and secrets are excluded from the commit.

## Migration compatibility

Inventory is 001–017, with no newer local migration and no changes to existing files. Tests compare fresh-install schema columns, constraints, indexes and triggers with upgrades from 010, 014 and already-current 017. Existing market history and canonical receipt/projection history survive upgrade unchanged. New receipts replay under the upgraded schema. Physical ancestry foreign keys, score-policy constraints and canonical immutability reject invalid mutations; existing execution uniqueness and RH accounting durability tests passed.

Migrations 012–015 support repeat application and were reapplied safely. One-time migrations 011, 016 and 017 intentionally reject repeat execution; tests establish atomic refusal and unchanged schema/history. An external migration runner must track applied migrations and skip them. This is not a claim that every SQL file is freely repeatable. Populated rollback refusal remains intact through existing migration/durability tests; 016 requires application/traffic rollback while retaining accounting data. No production migration was run. Target schema inventory, non-owner runtime grants, backup/restore rehearsal and a reviewed external runner remain required before deployment.

## Security findings and remaining deployment work

No critical authorization or payment-integrity defect was demonstrated in the integrated protocol boundaries. Public receipt/score reads remain free and wallet-free. Canonical writers, evaluator and accounting writes require admin authentication; invalid/missing credentials fail closed. Unsupported evaluator signatures remain rejected: evaluator provenance is authenticated internal adjudication, not an independently signed oracle. Four canonical receipts remain append-only; EvaluationService is sole score authority and legacy APIs cannot mutate reputation. Main's signing, settlement idempotency and replay protections are preserved.

Added tests reject malformed private targets without privileged fallback, caller score/clock fields and oversized bodies, and verify 30 shared judgment requests/IP/minute plus 20 execution proofs/IP/minute. Spoofed forwarded addresses do not reset the current limiter. Limiters remain process-local; narrow proxy trust/shared edge quotas, evaluator limits and bounded inspector history need work before broad or multi-replica exposure. Production readiness still blocks missing storage, schema, stale/non-live catalog and fixture fallback; its explicit migration inventory omits 012–015 and 017, so a complete external schema audit is mandatory.

The unchanged main lockfile has 11 dependency findings: eight high, two moderate and one low; zero classified critical by npm audit. No dependency upgrade was mixed into this minimal integration. The Fastify malformed-URL advisory requires protected custom not-found fallback handlers, which application source does not register; malformed targets were tested. Its async validation collision requires async request schemas, which the canonical handlers do not use; they explicitly parse Zod inputs. These are reachability findings, not a declaration that the affected dependencies are safe. Remediation and exact-artifact revalidation remain public-release blockers. [Fastify malformed-URL advisory](https://github.com/fastify/fastify/security/advisories/GHSA-p68q-wchp-6fh7), [Fastify async validation advisory](https://github.com/fastify/fastify/security/advisories/GHSA-667r-xxjv-c9mm).

Staging preparation must also establish safe Docker context exclusions, exact Linux image compatibility, live catalog refresh, issuer/operator credential rotation, database privileges/recovery, observability and incident ownership. Actual Railway configuration and live USDG facilitator/settlement readiness remain unverified. Begin with an isolated reviewed staging artifact and payments, economic execution and IPX launch operations disabled. This Phase 6A result authorizes no deployment, funded canary, production migration or token operation.

No push or merge into main was performed. The integration checkpoint is created only after passing the local integration gates; the final SHA is supplied in the completion report and task response.
