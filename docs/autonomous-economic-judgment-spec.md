# Infopunks autonomous economic judgment engine

Status: proposed technical specification v0.1 · 2026-10-07

**Jev chooses. Infopunks authorizes. Code executes. Receipts remember.**

Infopunks supplies bounded economic judgment above agent harnesses, route selectors, and execution rails. Radar establishes evidence; Jev supplies semantic suggestions; a deterministic Judge grants narrowly scoped authority; execution adapters enforce that authority; LoopLab records outcomes and dissent. “Before an agent spends, it checks Infopunks” becomes an enforceable protocol when the execution path requires a valid authorization.

This document specifies future work. Repository findings below describe inspected source, not production readiness or newly verified test results.

## 1. Existing foundation and remaining scope

| Area | Inspected foundation | Required extension |
| --- | --- | --- |
| Judgments | `src/services/judgmentService.ts`: scoped live observations, freshness, reviewed policy facts, vetoes, canonical decisions, x402 payment journal | Bounded Jev witness and explicit candidate/policy binding |
| Receipt memory | `receiptIntegrityService.ts`, `receiptAuthorityService.ts`: canonical hashes and parent ancestry | Witness, authorization, dissent, and rejected-attempt records |
| Execution proof | `executionProofService.ts`: external Base USDC proof, signer and settlement checks, authorization window | Pre-execution capability enforcement; Solana and Robinhood adapters |
| Evaluation | `evaluationService.ts`, `evaluationScorePolicy.ts`: execution ancestry and fixed outcome-to-score policy | Trace normalization, outcome evidence, Jev suggestions, economic attribution |
| LoopLab | `loopService.ts`: legacy heuristic public intake | Canonical precedent projections without promoting intake to authority |
| Revenue | `revenueReceiptService.ts`: public receipt templates/data | Actual decision billing, cost ledger, contribution margins |
| Jev | No integration found in inspected source | Versioned provider adapter and host-controlled decision protocol |

The existing paid route is `POST /v1/pre-spend/check`. Its configured payment path and external proof profile concern Base USDC; they do not establish Solana or Robinhood execution support. Earlier validation documents report local fixture tests, not live settlement. Existing evaluation source also means earlier documents saying evaluation was not begun are historical records, not a complete current inventory.

## 2. Constitutional invariants

1. Jev cannot create routes, alter amounts, add recipients, sign capabilities, call executors, or modify policy.
2. Candidate membership is necessary but insufficient for authorization. The Judge independently validates the selected candidate.
3. Verified vetoes dominate semantic suggestions and confidence. Unknown, stale, conflicting, or absent required evidence cannot authorize spending.
4. A paid judgment is a purchased assessment. Payment never buys approval or bypasses policy.
5. Receipt hashes establish integrity relative to trusted records. They do not prove source truth or signer authenticity.
6. Positive execution authority requires a separately signed, expiring, single-use capability. A model result, UI label, or receipt hash alone is insufficient.
7. The execution boundary rechecks revocation, live mutable constraints, and spend reservations immediately before the side effect.
8. Model outage, unsupported rail, persistence failure, or uncertain settlement never activates a permissive fallback.
9. Precedent is evidence for future assessment. It never silently rewrites policy or grants authority.
10. IPX holdings, token price, and fee contribution do not increase authorization confidence or reputation.

## 3. Evidence and cheap-first processing

Adapters produce immutable observations containing source identity, exact asset/provider/route identifiers, observation and ingestion times, expiry, raw artifact hash, parser version, chain and finality context, extraction method, and verification status. Maintain separate statuses for integrity, authenticity, freshness, completeness, and semantic support. Do not collapse these into one model score.

The pipeline is:

1. Fetch through registered adapters with bounded time, size, and request budgets.
2. Parse structured receipts and venue metrics deterministically. Normalize token amounts as atomic integer strings with explicit decimals; reject ambiguous units.
3. Verify chain, program/contract, issuer/provider identity, canonical block context, transaction success, and required provenance.
4. If interpretation remains ambiguous, construct candidate field values or source-span IDs in code. Jev selects a candidate or assesses whether an existing value is supported.
5. Code validates selected spans against the captured artifact and checks arithmetic, identifiers, and required fields. Semantic support alone cannot establish on-chain authenticity.
6. Publish qualified observations or record an unproven extraction attempt.

Jev is a typed decision model, so unrestricted text extraction is outside this adapter. A separate extractor may propose values, but proposals remain untrusted until verified.

For Solana, track signatures, slots, commitment/finality, program ownership, instruction decoding, token mints, vaults, balance deltas, and provider health. DEX price/liquidity calculations must identify their venue-specific method and block context. Streams require reconnect checkpoints, deduplication, gap detection, and handling of forked observations; incomplete coverage remains explicit.

## 4. Host-controlled decision protocol

TypeSafe documents three native Jev primitives: Choice, Score, and Noul. Choice returns a selected option, probability distribution, and confidence; Score evaluates a supplied rubric; Noul returns a yes-probability without a separate confidence field. `Abstain` is an Infopunks outcome: a menu option or a host threshold/failure mapping. A Noul near 0.5 expresses uncertainty, not a native abstention token. Sources: [introduction](https://docs.typesafe.ai/introduction), [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul).

The following are proposed internal contracts, not vendor wire schemas:

```ts
type DecisionRole = 'interpret' | 'select' | 'evaluate';
type Hash = `sha256:${string}`;
type AtomicAmount = string; // validated unsigned decimal integer

interface Candidate {
  id: string;
  action: 'inspect' | 'implement' | 'verify' | 'answer' | 'execute_route';
  handler_id: string;           // registered code handler, never executable text
  arguments_hash: Hash;        // binds immutable host-stored arguments
  execution_profile_id: string | null;
  evidence_ids: string[];
  estimated_cost: { asset_id: string; amount_atomic: AtomicAmount };
}

interface DecisionEnvelope {
  version: 'infopunks.decision.v1';
  request_id: string;
  principal_id: string;
  role: DecisionRole;
  intent_hash: Hash;
  state_hash: Hash;
  menu_hash: Hash;
  policy_hash: Hash;
  rubric_hash: Hash;
  model_id: string;
  expires_at: string;
  candidates: Candidate[];
  evidence_ids: string[];
}

type SuggestedAnswer =
  | { kind: 'choice'; candidate_id: string;
      probabilities: Record<string, number>; confidence: number }
  | { kind: 'score'; value: number; rubric_hash: Hash;
      probabilities: Record<string, number>; confidence: number }
  | { kind: 'noul'; probability_yes: number }
  | { kind: 'abstain'; reason_code: string };

interface JevWitness {
  envelope_hash: Hash;
  provider_response_hash: Hash;
  returned_model_id: string;
  answer: SuggestedAnswer;
  received_at: string;
  evidence_ids: string[]; // host-bound, not invented citations
  usage: { input_tokens: number; output_tokens: number } | null;
}
```

`jevWitness.ts` builds requests from immutable host state, records the raw response hash, validates the response, and wraps it with the original envelope binding. An echoed hash from the model is never trusted as verification. Pin a tested model revision, request template, rubric, schema, and calibration policy; unresolved model-version mismatch causes abstention.

Choice responses must contain exactly the requested option keys, including a host `abstain` option; values must be finite and within [0,1], with a versioned probability-sum tolerance. Reject unknown options, missing questions, malformed distributions, inconsistent selection, and out-of-range scores. Score bounds come from its rubric, not a universal [0,1] assumption. Noul thresholds and polarity are explicit per question.

Set confidence thresholds from labeled, domain-specific evaluation data. Model confidence is distinct from the existing 0–100 evidence qualification score and must not be substituted for it. No numeric threshold in this proposal establishes launch readiness.

Evidence is supplied as data, with bounded artifacts and no secrets. Source text cannot mutate questions, menus, or policy. An allowlisted HTTP client fetches citations before inference; Jev receives captured evidence rather than permission to browse arbitrary URLs.

## 5. Deterministic Judge

`judge.ts` accepts an envelope, validated witness or explicit deterministic selection, qualified observations, and a versioned policy. Its pure core returns a verdict and rule trace; transactional orchestration handles reservations and capability issuance.

Evaluate in this order:

1. Authenticate principal and delegated scope; validate input/schema/version and request idempotency.
2. Recompute immutable state, menu, rubric, and policy hashes; reject expired envelopes and changed bindings.
3. Apply independently verified hard vetoes, including revoked providers, forbidden assets/routers, and denied principal scope.
4. Verify required evidence ancestry, authenticity, freshness, completeness, intent, chain, and exact candidate binding.
5. Validate semantic selection and its calibrated thresholds. An abstention cannot become approval through retries.
6. Enforce allowlists, maximum amount, aggregate budgets, velocity, recipient, slippage, oracle deviation, transfer restrictions, and manual-review requirements.
7. Atomically reserve spend capacity against all active reservations and settled spend. For mixed assets, use a qualified valuation or separate per-asset caps.
8. Persist decision, witness, rule trace, dissent, and reservation. Only then issue a signed capability through a recoverable issuance workflow.

| Internal verdict | Existing canonical vocabulary | Spending authority |
| --- | --- | --- |
| ALLOW | `proceed` | Exact authorized operation |
| DEGRADE | `test_spend_first` | Explicit smaller operation with its own cap |
| BLOCK | `do_not_spend` | None; verified denial |
| UNPROVEN | `insufficient_evidence` | None; required qualification missing |

Diagnostic BLOCK decisions can be logged without observation parents. Keep the existing rule that a canonical judgment receipt requires real parents; never fabricate ancestry to represent a rejected attempt. Record both Jev's suggestion and the Judge's final verdict, with deterministic reason codes. A negative model suggestion alone is not a verified policy veto.

## 6. Authorization and execution

Keep `JudgmentReceipt` as assessment memory. Add a separate, versioned `ExecutionAuthorization` rather than inserting fields into the existing strict schema silently.

The signed payload MUST bind authorization ID and nonce, judgment receipt hash, principal/delegate, execution profile, chain ID, exact asset contract/mint, payer, recipient, router/program, method/instruction and argument hash, maximum debit and fees, bounded-test cap if applicable, slippage constraints, policy hash, reservation ID, validity interval, audience/executor, and signing-key ID. Sign domain-separated canonical bytes under `infopunks.execution-authorization.v1` using an algorithm supported and tested by the target verifier. All amount fields use atomic integers.

Execution performs signature, audience, key status, expiry, nonce, argument, chain, policy revocation, and reservation checks. Router choice cannot change after signing. Mutable prices and restrictions must satisfy the capability at execution time. The agent's wallet delegation or contract must make these checks mandatory; advisory Radar calls cannot prevent an agent using unrelated rails independently.

Use these separate state machines:

```text
Judgment purchase: quoted → payment_pending → settled → receipt_published
                             └→ reconciliation_required

Execution: reserved → authorized → submitted → finalized → evaluated
              └→ expired/released   └→ failed or reconciliation_required
```

Authorization expiry stops new submission; it does not erase an already submitted transaction. Nonce consumption and spend reservations must remain conservative through crashes and unknown chain outcomes. Resubmit only the same identifiable transaction where the rail safely permits it. Never retry an uncertain purchase or execution as a new economic action. Finalized receipts reconcile actual debit, fees, and unused reservation capacity.

An off-chain proxy cannot atomically commit its database and a remote transaction. Use a durable outbox plus rail idempotency and reconciliation. A contract executor must consume the nonce and enforce caps in the transaction. Signature enforcement does not replace the user's custody/delegation controls.

The current `/v1/execute-proof` is post-execution evidence intake. Preserve that distinction: accepting proof is not executing Pay.sh, and it cannot enforce pre-execution wallet behavior.

## 7. LoopLab precedent and evaluation

Normalize harness events into a versioned schema: trace/run/step IDs, principal, event type, time, parent step, intent hash, tool and argument hash, observation IDs, result artifact hashes, errors, latency, measured costs, and linked judgment/authorization/execution IDs. Record source harness and adapter versions. Detect duplicate/out-of-order events and expose missing coverage. Exclude secrets and unnecessary personal data.

Store denied choices, timeouts, and abstentions as `DecisionAttempt` records even when no execution exists. Store successful lineage as:

```text
Observation → DecisionAttempt/JevWitness → JudgmentReceipt
            → ExecutionAuthorization → ExecutionReceipt → EvaluationReceipt
```

Jev EVALUATE may flag repeated actions, dead ends, contradictions, or candidate outcomes. The deterministic evaluator validates the outcome evidence and computes score changes using versioned policy. Do not accept self-reported success or semantic surplus as settlement proof. Extend the existing evaluation service with qualified outcome evidence and evaluator provenance before changing reputation rules.

Precedent projections include authorization veto rate, abstention reasons, bounded-test outcomes, measured task completion, repeated paid failures, realized costs, and delayed adverse outcomes. Compare Jev and deterministic baselines on matched cohorts. Unobserved counterfactual savings remain estimates with methodology and coverage labels.

## 8. PLTR / RWA and IPX economic boundaries

An asset symbol is never identity. A PLTR verifier binds chain ID, exact contract, issuer, instrument/product identifier, terms version, backing/redemption evidence, oracle feed identity, update age, deviation bounds, transfer controls, eligible principals, and venue/router. An authenticated token transfer does not establish equity ownership, backing, or redeemability. Missing any required instrument qualification returns UNPROVEN.

Implement Robinhood/RWA adapters only against verified deployment identifiers and actual execution interfaces. This specification does not assume that the desired PLTR instrument, oracle, or Pay.sh route exists or is executable. Unsupported profiles remain disabled.

Introduce `/v1/decide` only as a versioned facade over the same Judge and payment journal. Preserve `/v1/pre-spend/check` and existing SDK compatibility. The facade returns canonical assessment plus witness/attempt references and an optional authorization reference; it does not treat `payment_required=false` or a provisional response as permission.

Keep the existing free-insufficient-evidence behavior. Start with the implemented stablecoin billing path, then add IPX as an explicitly priced, independently verified payment profile. Asset, network, amount, recipient, expiry, conversion source, and rounding are frozen in each quote. The judgment fee and downstream execution spend are separate settlements and ledger entries.

For each decision record settled fee revenue, refunds, inference attempts, provider verification charges, payment/gas costs paid by Infopunks, and reconciliation costs. Compute contribution margin as recognized decision revenue minus attributable variable costs. Define net distributable surplus separately after reserves and operating allocations. An unmeasured cost is unknown, not zero; failed/unpaid decisions still incur costs.

Token redistribution is a separate governed treasury workflow, initially disabled. Any future share, beneficiary, period, reserve rule, and mechanism must be versioned and reconciled against settled ledger entries. Judgment authority cannot depend on treasury incentives. Buybacks, burns, and staking rewards require independently verified execution receipts; no token-economic effect is inferred from API activity.

## 9. Implementation sequence and release gates

| Phase | Work | Exit condition |
| --- | --- | --- |
| 1: interpretation in shadow mode | Decision schemas, `jevWitness.ts`, pure `judge.ts`, cheap-first Solana adapters, attempt/dissent persistence | Schema and adversarial tests pass; labeled corpus measures semantic errors; Jev has no execution credentials |
| 2: precedent and bounded canary | Harness normalization, evaluation evidence, spend reservations, signed capability issuer and verifier | Crash/replay/revocation tests pass; bounded supported-rail canary reconciles every economic action |
| 3: qualified RWA execution | Exact instrument registry, oracle/transfer checks, validated router and rail adapters | Verified provenance and end-to-end capability enforcement for each enabled profile; uncertain cases remain blocked |
| 4: decision economics | `/v1/decide`, cost ledger, billing reconciliation, IPX payment profile if qualified | No double charges; complete measurable margins; treasury feature remains gated until separately validated |

Use independent feature flags for Jev shadow mode, Jev suggestions, signed authorization issuance, each execution profile, paid facade, IPX payments, and treasury execution. Disabling Jev retains only independently qualified deterministic decisions. Disabling an executor revokes its outstanding authority and triggers reservation reconciliation rather than deleting history.

Required verification scenarios:

- Injected evidence requesting policy overrides, invented route IDs, malformed probabilities, and model/version mismatch cannot authorize.
- High-confidence choice loses to a verified veto; fresh positive evidence cannot hide a newer negative state.
- Changed menu, arguments, recipient, policy, chain, or evidence hash invalidates the original binding.
- Boundary confidence, missing cost, stale oracle, trace gaps, unsupported assets, provider timeout, and storage failure fail closed.
- Concurrent requests cannot exceed caps; cross-process replay cannot consume a nonce or charge twice.
- Crash after settlement, capability issuance, nonce reservation, submission, and finalization recovers without duplicate economic effects.
- Forged signatures, revoked keys, wrong audience, expired capabilities, and fee transactions presented as execution proof are rejected.
- Unverified traces cannot alter canonical reputation; measured outcomes cannot be attributed to the wrong judgment or model revision.

Before enabling a profile, record exact environment/configuration, migration state, signer and custody model, contract/program identifiers, corpus and thresholds, test results, and an authorized live end-to-end receipt lineage. Specify numeric error, latency, cost, and reconciliation targets from measured data before canary approval. Local mocks are insufficient evidence of live rail support.

## 10. Decisions needed before implementation

1. Select the first enabled execution rail and exact capability verifier; start with an already qualified profile rather than assuming multi-chain parity.
2. Define principal authentication/delegation, custody ownership, signature algorithm, key rotation, and emergency revocation.
3. Select the pinned Jev revision, evaluation corpus, rubrics, confidence thresholds, and per-request inference budget.
4. Supply exact IPX/PLTR asset identifiers and instrument/issuer evidence where required; unknown identifiers cannot be guessed.
5. Set deterministic caps, velocity windows, manual-review requirements, fee/refund policy, and settlement reconciliation ownership.
6. Define treasury surplus and governance only after settled decision unit economics are measurable.

These are explicit configuration and product decisions, not permissions granted to Jev. The engine can be built incrementally while unsupported economic actions remain closed.
