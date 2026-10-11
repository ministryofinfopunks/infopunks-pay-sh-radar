# E1-A reviewer authority qualification — 2026-10-11

**Decision: NO-GO for integration.** The corrected implementation passes disposable PostgreSQL qualification, including restart and replay. Integration is blocked by duplicate migration 018 and divergent Track A receipt-authority semantics. E1-B, E1-C, E2, E3, production migration, reputation activation, payments, settlement, and Decisions authorization remain NO-GO.

Baseline: `b9597fc0388d5f08ea1a611b50e12fcab7102fd9`.
Qualification branch: `codex/e1-a-durability-qualification`.
Tested implementation commit: `40eec72d15d65a603c3b206e99a324e17a560541`.
Tested source manifest: `sha256:a3e4ab788b0e11c950ad247592072087ec549db3eecdcad9f0abe3b991b90bf5`.

## Results and evidence

- **1,965 tests passed across 272 test files; zero failed or skipped.** All 32 E1-A qualification cases passed with PostgreSQL enabled. Typecheck, repository lint, and server/client build passed.
- PostgreSQL **14.20** ran in a new temporary cluster, bound to loopback on an ephemeral port. SCRAM passwords were generated for a bootstrap role, a non-superuser migration owner, and a separate runtime role. The runtime role received SELECT/INSERT and sequence access, without schema ownership, UPDATE, DELETE, TRUNCATE, or DDL authority. Reviewer and judgment keys were separate ephemeral test pairs.
- The complete branch migration path **001–018 plus 023** applied successfully. Empty-schema rollback/reapply of 023, 018, and 017 passed; populated reviewer rollback was refused. Existing migration 016 intentionally refuses rollback to preserve immutable accounting; its refusal is recorded as an expected boundary, and its implementation was not changed.
- Concurrent identical submissions returned one identical receipt; concurrent conflicting verdicts produced exactly one authoritative outcome. Nonce reuse, signature changes, unapproved rubrics, missing executions, invalid timestamps, revoked keys, and validity-window violations were rejected.
- After the original connection pool was closed, another pool read and replayed the stored chain. A separate verifier implementation checked content hashes, evidence-manifest digest, parent links, reviewer identity/registry binding, reviewer signature, and judgment signature without using the application's hash/signing-byte helper functions.
- After a PostgreSQL server restart, the persisted Evaluation and sidecar were byte-identical, the pinned registry digest was unchanged, and the complete ancestry replay passed. The runner subsequently stopped and removed the cluster and its passwords.
- Both Evaluation HTTP write paths were exercised through PostgreSQL with operator authentication and reviewer signatures. Both staging score routes returned 503. A snapshot of every other table remained unchanged across HTTP acceptance and score reads. Runtime DDL and destructive-write attempts were denied.

The machine report is [qualification-report.json](evidence/e1-a/qualification-report.json). Final command results, log hashes, test case outcomes, and cleanup evidence are in [qualification/run.json](evidence/e1-a/qualification/run.json). The full test report is [qualification/vitest.json](evidence/e1-a/qualification/vitest.json). The archived [synthetic durability bundle](evidence/e1-a/qualification/synthetic-durability-bundle.json) and [post-restart replay report](evidence/e1-a/qualification/post-restart-replay.json) contain only public keys and test evidence.

**All outcome evidence in this packet is synthetic.** The protocol's verified field describes authorized test attestations. No human reviewer assessed a genuine provider result, and no authentic external causal loop was obtained. These results establish internal authorization/persistence behavior only; decision safety, provider delivery, model quality, commercial readiness, crash recovery, and replica failover are unqualified.

## Threat findings and corrections

The baseline's original five authority/durability tests passed against PostgreSQL. An independently constructed 26-case adversarial suite then reproduced five failures (21 passed, 5 failed), preserved in [adversarial-baseline](evidence/e1-a/adversarial-baseline/run.json). The first full regression run exposed an additional concurrent retry failure, preserved in [initial-full-regression](evidence/e1-a/initial-full-regression/run.json). Failed evidence remains in the packet.

| Finding | Reproduction / correction |
| --- | --- |
| Colon-concatenated reviewer/key lookup allowed an unregistered identity alias | Reproduced in PostgreSQL; reviewer/key lookup now uses a JSON tuple. |
| Private PEM accepted in the public trust configuration | Reproduced; private-key input is rejected and only an Ed25519 public key is loaded. |
| A legacy-policy receipt could claim unsigned verified provenance | Reproduced through direct append; verified provenance now requires the reviewer-attested policy in application validation and migration 023. Existing internal-policy error behavior remains compatible. |
| A resealed receipt could shift the signed review time | Reproduced during replay; Evaluation time must equal the signed review instant. |
| A review dated before execution could pass the direct append path with a later Evaluation time | Reproduced; exact time binding and execution chronology are enforced by replay and the database trigger. |
| Concurrent identical writes could collide on the receipt-hash unique index | Reproduced during the first full run; after rollback the store returns only an existing byte-identical, already-validated record. Conflicting content remains rejected. |
| SQL NULL could bypass sidecar JSON consistency checks | Found by source inspection; 023 requires signed fields and rejects missing-signature SQL inserts. |
| Public reads returned raw Evaluation claims without rechecking authority | Found by source inspection; forged SQL fixture rows now fail replay and return 409 instead of an accepted Evaluation on public reads. |
| Registry ordering depended on locale | Ordering now uses lexical comparison. Freeze registry digests using the qualified implementation; do not rewrite existing signed attestations to match another normalization. |

PostgreSQL checks field consistency and immutability; Ed25519 verification and trusted-key authorization remain application authority. A database owner/superuser can corrupt or replace schema outside that trust boundary. A raw SQL `verification=verified` value alone is not authority: the forged fixture was denied during replay and public read. Deployment must separate migration ownership from runtime privileges as demonstrated here.

Attestation and Evaluation writes are separate commits. A failure between them can leave a pending sidecar without an accepted Evaluation. The interruption test proves an identical signed retry completes the receipt exactly once. Archive the original sidecar and pinned registry; do not replace a pending statement with a conflicting outcome. Changed/revoked trust fails closed, and historical verification requires an explicitly selected immutable registry snapshot.

## Write-path audit

| Surface | Authority behavior |
| --- | --- |
| `POST /v1/evaluate` | Operator authentication plus `acceptReviewed`; unsigned requests, untrusted signatures, authored deltas, and conflicts rejected. |
| `POST /internal/receipt-spine/evaluation` | The same reviewed acceptance handler; no generic raw Evaluation append route. |
| Generic Observation/Judgment/Execution intake | Separate authenticated writers; no Evaluation tuple. |
| `POST /v1/receipts` | Legacy pre-spend receipt intake; nonzero confidence delta rejected; no canonical Evaluation or reputation authority. |
| Commercial evaluation-request / Unicorn intake | Intake surfaces; no canonical Evaluation append or score authority. |
| Economic-engine trace events / host routes | No HTTP exposure of `evaluateExecution`; trace events have no reputation authority. |
| Internal `createEvaluation`, `submit`, repository append | Trusted in-process compatibility paths; cannot establish reviewer-verified authority without a valid signed sidecar. Legacy/internal profiles remain distinct from reviewer-attested verification. |
| Score routes and pre-spend history | E1 staging flag disables both score routes and Evaluation-derived history in judgments. Projection is computed on reads and has no independent persistent reputation table. |

No Evaluation UPDATE/DELETE API exists. Database triggers and runtime privileges protect accepted receipts and sidecars from destructive changes. Hermes/scout display statistics and community intake are separate derived surfaces; no production or community records were changed by qualification.

## Migration compatibility and remaining owners

The pinned Track A comparison is `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. Shared migrations 001–017 are identical, and reviewer migration 018 is preserved byte-for-byte. Track A's `20261008_018_decision_context` conflicts numerically with `20261009_018_evaluation_reviewer_attestations`. Concurrent local branches also reserve 019–022; corrective migration 023 is new and does not renumber the frozen migrations. Both reviewer-first and Track-A-first DDL orders passed in disposable schemas, but that does not resolve the numbering collision or application semantics.

Track A has canonical receipt v2/decision context, receipt acceptance records, and execution score eligibility. This branch has reviewer trust, sidecars, and the attested score policy. Neither version alone qualifies a combined application. See [migration-compatibility.json](evidence/e1-a/qualification/migration-compatibility.json) for exact hashes and concurrent reservations.

The **Track A / receipt-authority integration maintainer** must allocate a compatible migration identity and reconcile these authority checks while retaining frozen history and both sets of regression gates. No combined code was merged and no production migration was attempted. An **operator and independent reviewer** still own the approved real rubric, reviewer roster, evidence archive, qualified provider, and bounded transaction authorization for E1-B/E1-C. No provider approval or delivery guarantee was inferred here.

## Reproduction and release gates

### Disposable staging checklist

- Resolve the migration collision and authority reconciliation before applying this branch alongside Track A; rerun both regression suites on the combined candidate.
- Use an empty disposable database, a separate migration owner, and a runtime role limited to the demonstrated append/read grants. Do not reuse production URLs, roles, tokens, issuer authority, or signing keys.
- Explicitly set `EVALUATION_REPUTATION_PROJECTION_ENABLED=false` (its default is true), `OPENAI_DECISIONS_SHADOW_ENABLED=false`, and `JUDGMENT_PAYMENT_ENABLED=false`. Leave external ingestion, execution, signing/settlement integration, and publication disabled; restrict outbound network access.
- Freeze the approved rubric, outcome manifest, reviewer/public-key roster in `EVALUATION_REVIEWER_TRUST_JSON`, validity periods, and registry digest. Keep reviewer private keys outside the application; provision a separate test issuer and operator token.
- Archive the original request, attestation, four receipts, exact rubric/evidence manifests, public-key registry snapshot, policy version, and verifier results in an immutable evidence archive. This synthetic packet is not a substitute for genuine execution evidence.
- Confirm unsigned and untrusted requests fail at both Evaluation routes; confirm both score routes return 503. Restart PostgreSQL and require byte-identical receipt/sidecar recovery, independent signature verification, and complete ancestry replay before approving internal staging readiness.
- Have an independent maintainer review the fixes and test packet. Provider qualification, independent outcome review, and financial authorization are later gates; no genuine execution is approved by this checklist.

From the qualification branch, install the locked dependencies and provide local PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`, `postgres`). Run:

```sh
node scripts/qualify-e1-a.mjs --output=/tmp/infopunks-e1-a-reproduction
```

The runner creates its own database and cannot take an operator-provided production URL. `E1_A_PG_BIN_DIR` may identify a local PostgreSQL binary directory. Baseline/adversarial results are archived in this commit; a fresh run generates new ephemeral keys. The fixed synthetic bundle retains the exact signed receipt material for hash/signature replay.

| Gate | Decision |
| --- | --- |
| Corrected isolated PostgreSQL authority/persistence checks | PASS, test scope only |
| E1-A integration / overall release recommendation | **NO-GO**: migration collision and receipt-authority reconciliation |
| E1-B genuine external evidence acquisition | NO-GO / not executed |
| E1-C first verified real causal loop | NO-GO / zero genuine loops certified |
| E2 safety qualification | NO-GO / reviewed representative outcomes unavailable |
| E3 Decisions activation and paid economics | NO-GO / live qualification and separate authorization unavailable |

Exact changed paths and the implementation commit are in [changed-files.json](evidence/e1-a/changed-files.json). The baseline branch remains untouched. No production database/key access, paid provider call, fund movement, reputation mutation, deployment, billing activation, or Decisions authorization occurred.
