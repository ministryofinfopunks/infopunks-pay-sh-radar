# Phase 2 and Phase 3 completion record — 2026-10-07

Implemented canonical paid pre-spend judgment and free external execution proof intake. Phase 4 was not begun. Existing unrelated workspace changes were preserved. No production deployment, production migration, mainnet payment, wallet funding or Pay.sh purchase was performed.

## Gate order and exact results

The initial prerequisite run passed all 41 canonical receipt integrity, authority, spine and legacy-lockdown tests, including the six dedicated local PostgreSQL cases. No Phase 2 edit began before that result.

Phase 2 passed its focused payment/SDK/CORS checks, full suite (231 files, 1707 passed, one existing resilience case skipped), typecheck, lint, build and whitespace checks before Phase 3 began. See `phase2-validation.md` for that historical gate record. The previously skipped real PostgreSQL resilience case was enabled during final validation.

Final source and tests:

| Gate | Actual final result |
| --- | --- |
| Full Vitest suite with both canonical receipt and resilience test URLs pointing to the dedicated local PostgreSQL cluster | **235 files passed; 1737 tests passed; 0 failed; 0 skipped. Exit 0.** |
| `npm run typecheck` | Passed, exit 0. |
| `npm run lint` | Passed, exit 0. |
| `npm run build` | Passed, exit 0; existing large frontend chunk warning remains. |
| `git diff --check` | Passed, exit 0. |
| Fresh paid-judgment benchmark against local PostgreSQL with an explicit test facilitator | Passed; 110 distinct settlements/receipts, 10 warmups and 100 measured samples. No real funds moved. |

The final full suite took 110.35 seconds. Relative to the Phase 1 baseline there are 66 additional test cases. All original database receipt cases ran; the real PostgreSQL checked-out connection termination/recovery test also ran. Its old zero-listener assertion was corrected to verify removal of application listeners while allowing pg-pool's driver safety listener. Actual termination, error containment and recovery assertions remain enforced; production database behavior was not weakened.

## Canonical decision mapping

The deterministic legacy engine remains in place. One explicit adapter maps the existing vocabulary after scoped evidence gates:

| State | Canonical result |
| --- | --- |
| approved | proceed only with explicit reviewed approval, threshold confidence and no veto |
| approved_with_warning | test_spend_first only with sufficient explicit bounded policy; otherwise insufficient_evidence |
| use_with_caution | test_spend_first only with sufficient explicit bounded policy; otherwise insufficient_evidence |
| requires_human_approval | insufficient_evidence |
| do_not_use | do_not_spend with sufficient reviewed negative evidence |
| unknown or ambiguous | insufficient_evidence |

Reviewed policy facts may resolve the Phase 1 engine's intentionally non-authoritative caution state. A legacy approval cannot override a reviewed warning/negative. Legacy deterministic vetoes and human-approval requirements are retained. A legacy negative unsupported by reviewed negative facts yields insufficient evidence.

Missing/fixture/stale/disputed evidence, absent catalog or identity, incomplete required proof, missing observations, scope/route mismatch, unmet intent/constraints, unsupported settlement and below-threshold approval all fail closed. The latest scoped materialized observation supersedes historical snapshots; newer negative/stale states are not skipped to find an older approval. The request hash binds all parsed pre-spend intent/constraint fields. Paid validity is policy-configured and capped by observation freshness. Insufficient evidence costs exactly zero, requires no payment, challenges nobody and publishes no positive receipt.

## Protocol, networks and idempotency

Uses the official x402 Foundation `@x402/core` **2.28.0** and `@x402/evm` **2.28.0**, including V2 codecs, exact EVM requirements, resource server and HTTP facilitator client: https://github.com/x402-foundation/x402.

Standard base64 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE` headers implement challenge, verified retry and settlement acknowledgement. Canonical receipt publication follows successful verification and settlement. The internal reviewed receipt writer rejects paid judgment flags/references/charges, preventing paid-publication bypass. Original SDK response fields remain in `data`, with optional `canonical_judgment`; canonical fields are also at the top level.

**Actually verified live settlement networks: none.** Base mainnet USDC is implemented and tested against explicit test facilitator/RPC fixtures. Payments default disabled. Configured startup requires durable storage, migration 012, recipient/resource/facilitator settings and advertised Base V2 exact capability. Solana is explicitly unsupported. No production support or payment success was simulated.

The durable journal freezes quotes and uses compare-and-set plus unique payment and settlement identifiers. Same key/different payload returns 409. Identical paid retries and restarts replay the same receipt without another charge. A persisted settlement can recover publication. An uncertain settlement remains pending reconciliation and is never automatically resubmitted. Signatures are not persisted or logged in the payment journal.

## Execution proof

`POST /v1/execute-proof` is free and never executes Pay.sh or performs payment. The supported `base_usdc_external.v1` profile requires a known EIP-191 EOA signer and an actual finalized Base USDC transaction, bound to reviewed recipient, payer, authorized request hash, cost limit and judgment window. It rejects the judgment fee as a substitute for external execution settlement. Unconfigured/unsupported verifiers fail closed.

Parent integrity/ancestry, subject/signer context, explicit constraints and historical authorization time are validated. Blocking/insufficient decisions cannot author execution. Request/response hashes and execution status remain clearly identified signed external claims; no unavailable payload verification is invented. Canonical receipt metadata records settlement provenance and signer. Receipts remain append-only and tampering breaks integrity.

Identical idempotent proof returns one receipt; conflicts return 409. Both memory and PostgreSQL enforce one profiled execution per judgment and per settlement, including across rail aliases and process restart. Submission triggers no x402 challenge, no external purchase and zero reputation mutation. Strict schemas, body/ref limits, existing Fastify rate limiting and structured logs protect the write surface. Reads remain wallet-free.

## Performance

| Local measurement | Samples | p95 |
| --- | ---: | ---: |
| Fresh quote + verification + settlement + receipt publication, PostgreSQL, excluding test facilitator call duration | 100 after 10 warmups | **2.436 ms** |
| Insufficient evidence, PostgreSQL | 100 | **0.609 ms** |
| Paid replay, PostgreSQL | 100 | **6.249 ms** |

Artifacts: `output/phase2-judgment-fresh-postgres-performance.json`, `output/phase2-judgment-postgres-performance.json`, and the memory-adapter results in `output/phase2-judgment-performance.json`. These are local service measurements with explicit test payment infrastructure, not a production load test or live facilitator latency measurement. Timing instrumentation separates local processing from facilitator calls. The hot path uses indexed materialized evidence and performs no unrelated analytics or live catalog refresh.

## Required deployment work and practical limits

Apply migrations 012 and 013 after the canonical spine migration 011, configure an operational Base facilitator and Base proof RPC, and perform an authorized live settlement smoke test before claiming live rail support. New down migrations refuse removal of nonempty payment memory or populated execution authority protections. Production credentials and DB privileges still need operator validation.

The execution profile relies on the configured RPC chain view and known EOA attestations; smart-contract signatures and Solana/reference-only profiles are not supported. Uncertain payment outcomes require operator reconciliation. Admin-reviewed materialized facts establish the policy qualification; receipt hashes establish integrity, not source truth. No Phase 4 evaluation implementation was added.

Contract details: `phase2-canonical-judgments.md` and `phase3-execution-proof.md`.
