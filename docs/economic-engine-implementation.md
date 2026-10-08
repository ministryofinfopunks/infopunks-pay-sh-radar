# Autonomous economic judgment engine — implementation

2026-10-08. Implements the core protocol from `autonomous-economic-judgment-spec.md`.

**A judgment receipt records the assessment. A separately signed capability grants execution authority.**

## Delivered protocol

- `src/schemas/economicEngine.ts`: closed candidate menus, exact chain/asset/contract and amount units, versioned policies, host envelopes, Jev witnesses, signed capabilities, normalized harness events and cost entries.
- `src/services/jevWitness.ts`: pinned Jev HTTP integration, Choice/Score/Noul validation, host abstention, bounded responses and deadlines. The fixed provider URL cannot be supplied through evidence or a public request. No automatic inference retry.
- `src/services/judge.ts`: pure deterministic evidence and policy evaluation. Signature integrity does not establish source truth. Reviewed economic facts must bind the exact candidate and policy. Latest source snapshots supersede older approvals even when the new snapshot is incomplete or negative.
- `src/services/economicJudgmentEngine.ts`: durable attempts, dissent, assessment publication, aggregate per-asset reservations, velocity constraints, separately signed capability issuance and publication recovery. A host deterministic selector can skip Jev; it retains all independent evidence gates.
- `src/security/executionAuthorization.ts`: Ed25519 signatures under `infopunks.execution-authorization.v1`, independent of the judgment issuer signature domain. Capabilities bind the principal, delegate, executor audience, chain, token contract, payer, recipient, router, method, argument hash, amounts, fees, slippage, policy, evidence envelope, witness, reservation, nonce and validity interval.
- `src/services/economicExecutionGate.ts`: mandatory verification and single-use reservation claim before calling a registered executor. Independent finalized-outcome verification precedes receipt publication. Unknown submission outcomes stay reserved for reconciliation. Durable capability/profile revocations release only unsubmitted reservations.
- `src/services/economicPrecedentService.ts`: trace normalization, coverage gaps, repeated actions, timestamp regressions, verified outcome evaluation, inference-call counting and cost accounting. Traces and model suggestions cannot author reputation changes.
- `src/ingestion/economicEvidenceAdapters.ts`: finalized Solana RPC telemetry extraction and RWA instrument qualification. The latter requires independently verified source data, exact instrument/terms identity, transfer eligibility and fresh oracle constraints.
- `src/persistence/economicEngineStore.ts`: isolated memory fixtures and PostgreSQL transactions, cross-process serialization, record-integrity checking and constrained lifecycle transitions.

The server-side host integration is exported as `./economic-engine`. Public SDK behavior stays compatible.

## HTTP boundaries

`POST /v1/decide` shares the existing assessment/payment service and payment journal with `/v1/pre-spend/check`. It rejects extra authority fields. Insufficient evidence stays free; paid decisions retain the existing x402 challenge and settlement flow. Its `execution_authorization` is null and `execution_authorized` is false: the public assessment interface cannot invent host menus, delegation, policy or executors.

`GET /v1/receipt-spine/judgment/:id/verify` now reports `assessment_eligible` separately. `execution_authorized` is always false for a receipt alone; `authority_requires` names the capability protocol. Issuer-authenticated assessment eligibility is a prerequisite rather than permission to call an execution rail.

These routes exist only when the economic engine is enabled and require the configured `ADMIN_TOKEN` bearer credential. That credential represents trusted host authority acting for a configured principal; an unauthenticated `agent_id` is not delegation.

| Route | Purpose |
| --- | --- |
| `POST /internal/economic-engine/decide` | Submit a host-prepared typed job; read canonical observations from server storage |
| `GET /internal/economic-engine/attempts/:id` | Inspect suggestion, rule trace, dissent, judgment and capability |
| `POST /internal/economic-engine/recover-assessment` | Recover a persisted assessed attempt without another inference call |
| `POST /internal/economic-engine/execute` | Verify capability and exact operation, then claim once and dispatch |
| `POST /internal/economic-engine/reconcile` | Query an already submitted action; never initiate a replacement purchase |
| `POST /internal/economic-engine/revoke` | Permanently revoke an authorization or profile revision across workers |
| `POST /internal/economic-engine/trace-events` | Accept strict, normalized host telemetry |
| `GET /internal/economic-engine/traces/:principal/:trace/:run` | Inspect trace coverage and diagnostic repetition |
| `GET /internal/economic-engine/summary` | Read attempt, inference, dissent, authority and execution counts |
| `GET /internal/economic-engine/economics/:attempt/:asset` | Read costs, qualified revenue and margin coverage |

`GET /v1/execution-authorization/keys` publishes only public capability keys when the engine is enabled. Consumers establish trust independently; discovering keys from the same server is not a trust root.

The existing `/v1/execute-proof` remains post-execution proof intake. It does not spend funds and does not enforce capabilities on external wallets. The new execution gate is the capability-enforcing host boundary.

## Configuration and rollout

The default is disabled. `.env.example` documents these flags:

```dotenv
ECONOMIC_ENGINE_ENABLED=false
ECONOMIC_ENGINE_SHADOW_MODE=true
ECONOMIC_ENGINE_JEV_ENABLED=false
ECONOMIC_ENGINE_AUTHORIZATION_ENABLED=false
ECONOMIC_ENGINE_POLICIES_JSON=[]
```

1. Apply `20261007_015_economic_judgment_engine.up.sql` after the canonical receipt spine. The migration does not run automatically. Its down migration refuses to remove populated economic memory. Existing judgment, execution-proof and evaluation migrations remain independently required for their respective services.
2. Configure host authentication and reviewed policies. Policy asset IDs use `<chain_id>/<exact_contract_or_mint>` and explicitly bind decimals. The initial engine supports fees denominated in the debit asset only; mixed-asset gas and fees need a qualified conversion or a later separate budget profile. They are not silently combined.
3. Enable shadow mode first. If Jev is enabled, supply `TYPESAFE_API_KEY`; each job must pin an exact revision such as `jev-x.y.z`, with tested rubrics and thresholds. No alias or threshold is treated as calibrated merely because it parses.
4. Publish reviewed economic observations through the protected canonical writer. Their `source_type` is `reviewed_economic_facts`; `EconomicEvidenceFactsSchema` binds candidate and policy hashes. Telemetry extraction alone must not publish such qualification.
5. Register an `EconomicExecutor` through the server's `CreateAppOptions.economicEngine` host integration. Configure a live `currentPolicy` resolver for mutable policy revocation. Environment policies are startup snapshots, not a distributed policy feed.
6. Configure `EXECUTION_AUTHORIZATION_ISSUER`, `EXECUTION_AUTHORIZATION_KEYS_JSON`, `EXECUTION_AUTHORIZATION_KEY_ID` and `EXECUTION_AUTHORIZATION_PRIVATE_KEY` through secret management. A registry entry uses the same public Ed25519 key record format as the judgment issuer; the execution signature domain remains distinct even if a deployment chooses the same key material.
7. After domain-specific calibration and an authorized supported-rail canary, disable shadow mode and explicitly enable capability issuance. Production issuance refuses an in-memory store, missing issuer or absent executor registration.

Do not commit signing keys. Every executor must verify mutable constraints and enforce the capability at its actual economic side-effect boundary. The host cannot prevent an independent wallet from using unrelated rails.

## Executor integration contract

A registered executor supplies `profile_id`, `preflight`, `execute`, `verify`, and optionally `reconcile`:

- `preflight` checks the actual chain, route/provider state, balances, oracle and transfer restrictions. The gate rechecks policy, signature expiry, revocation and latest evidence after preflight.
- `execute` receives only the frozen operation and signed capability. It must enforce the same fields at its transaction/purchase boundary and use the capability ID as durable rail idempotency identity.
- `verify` independently checks finalized settlement and outcome artifacts. Returning an unverified success string is insufficient.
- `reconcile` queries the original action by that identity. It must not resubmit the action under a new nonce.

No production purchase executor is registered by default. Tests register explicitly labeled fixture executors; they never move real funds. Solana telemetry and RWA qualification adapters are usable building blocks, not a claim of live Solana/PLTR execution or complete streaming ingestion. Venue-specific DEX decoders, stream/backfill checkpoints, exact deployment/instrument registries and actual Pay.sh/contract executors require source-specific integration and live validation before enabling their profiles.

## Persistence and crash behavior

Economic mutations use a PostgreSQL advisory transaction lock shared across processes. This deliberately serializes budget/nonce decisions for correctness. Network inference, preflight, execution and verification occur outside database transactions. Large-volume deployments should add indexed scoped readers and formally verified lock sharding before claiming throughput targets.

Attempts freeze the host job and envelope before inference. An inference timeout becomes abstention; a process that disappears during inference leaves a pending attempt rather than silently performing another paid inference. Inference costs are recorded as unknown before the provider call, so missing results cannot imply zero cost.

Assessed attempts and reservations persist before canonical assessment publication. Publication/signing recovery reuses the same attempt and timestamps. Execution is marked submitted before dispatch. A crash at that boundary conservatively requires reconciliation, including a crash before the remote action started. Expiry and revocation release unsubmitted reservations only; submitted exposure remains reserved until verified settlement. Verified outcomes persist before canonical execution publication, allowing receipt recovery without another execution.

Revocations are append-only and permanent for the named capability/profile revision. A new reviewed profile revision can be introduced after the failure is resolved. Key rotation retains public historical keys and the original receipt/capability for replay; key revocation deliberately prevents new execution under the revoked key.

## Economic memory

Inference confidence, account balances and token prices cannot grant authority. Historical trace diagnostics cannot promote evidence or rewrite policy. The existing deterministic evaluation policy remains the sole score-delta authority after independently verified task outcomes.

Unknown inference cost remains null until an independently checked append-only resolution entry names `resolves_entry_id`. Contribution margin stays null while any required variable-cost category is missing, unknown or denominated in a different asset. Known-cost subtotals are not net surplus. Treasury execution, IPX decision payments and token redistribution remain disabled in this engine; no economic feedback is inferred from API calls.

## Validation

The focused suites cover typed-response rejection, uncertainty, immutable bindings, verified vetoes, latest-evidence supersession, exact amounts/units, signed assessment versus capability separation, forged signatures, principal/delegate/audience restrictions, caps, concurrent reservation/nonce claims, expiry/revocation, publication recovery, uncertain submission reconciliation, trace coverage, outcome evaluation and margin incompleteness. PostgreSQL tests use a dedicated disposable local cluster and separate schemas.

Final local validation on 2026-10-08: all 253 test files passed, with 1,855 tests passing, including the enabled PostgreSQL engine, canonical receipt and resilience integration suites. Type checking, linting, the production build and whitespace checks passed. The frontend build retains its existing large-chunk advisory.

Local fixture verification establishes implementation behavior; it does not establish live rail support, deployed signer custody, instrument backing, model calibration or production deployment.
