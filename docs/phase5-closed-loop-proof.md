# Phase 5: end-to-end closed-loop proof

This phase exercises Observe → Judge → External Settle → Execute Proof → Evaluate → Derived Score → Judge Again through real Fastify HTTP handlers and loopback network connections. PostgreSQL owns the append-only history. No core receipt is manually constructed in the end-to-end scenario.

Evidence classification is **LOCAL** throughout. The facilitator records deterministic simulated billing settlement. The external adapter serves a synthetic finalized Base USDC transfer through JSON-RPC. Neither transaction is a live Pay.sh transaction, a testnet transfer, or production economic proof.

## Frozen checkout and scope

Starting commit: `e5d009f6943339f235f329443af500d2e77425dd`.

Branch: `codex/phase5-closed-loop-proof`.

Worktree: `/Users/ahdilm/.codex/worktrees/phase5-closed-loop-proof/Infopunks Pay.sh Intelligence Terminal`.

HEAD and the empty working-tree status were verified before editing. Node 25.6.1, the installed lockfile dependencies, and PostgreSQL 14.20 were available. Existing Phase 1–4 docs, authority, judgment, execution, evaluation, projection, integrity, migrations, and tests were inspected. The main development checkout was not modified. No push, merge, deployment, production migration, token launch, or IPX/PLTR economic operation was performed. Existing Robinhood/IPX functionality and billing configuration were preserved.

The completion JSON records the exact HEAD, changed files, source fingerprint, validation results, receipt identifiers, hashes, and full redacted HTTP request/response transcript. Uncommitted changes are explicitly distinguished from the starting SHA.

## Reproduce

Create a disposable database on local PostgreSQL, then set its URL. The runner rejects non-loopback database hosts. Every invocation creates a UUID schema, applies the existing migrations to that schema, and tears it down after verification. Migrations 001–017 are used only as local test infrastructure; none are deployed.

```sh
createdb infopunks_phase5_test
export CANONICAL_RECEIPT_TEST_URL=postgresql://localhost/infopunks_phase5_test
npm run proof:phase5
npm run test:phase5
npm run validate:phase5
```

`validate:phase5` enables the existing canonical, economic-engine, and PostgreSQL resilience suites using that local database. It runs typecheck, lint, full tests, protocol/integrity/security/UI tests, production build, diff-check, authority audit, and the standalone HTTP scenario sequentially. Source fingerprints before and after must match. Each command's log and structured result is saved in `output/phase5`.

Run the existing controlled benchmark separately with no compiler/test workloads running:

```sh
CANONICAL_RECEIPT_TEST_URL=postgresql://localhost/infopunks_phase5_test npx tsx scripts/benchmark-derived-score.ts
```

The benchmark rejects competing compiler/test processes. Its original output is under `output/phase4.1`; the Phase 5 evidence preserves a copy under `output/phase5`. It measures 300 fresh paid judgments after 30 warmups with 100 historical evaluations. Local timing includes PostgreSQL evidence lookup, ancestry verification, projection, policy, journal, and receipt persistence. Facilitator time is excluded by the existing timing hook. It is a local performance result, not a production load guarantee.

## Supported boundaries

The observation enters through authenticated `POST /internal/receipt-spine/observation`. Reviewed facts bind the complete request hash, provider, selected token-quote route, evidence window, execution request hash, known external signer, recipient, asset, and maximum cost. The fixture explicitly records `evidence_classification: LOCAL` and `source_adapter: deterministic_loopback`. The existing `catalog_source: live` field is the reviewed-current-source gate vocabulary; it does not classify this fixture as live economic settlement.

The unmodified legacy pre-spend policy selects the existing Quartz token-quote route. Scoped reviewed facts satisfy the canonical evidence gate with confidence 90. No judgment decision override, legacy score mutation, or manual reputation injection is used.

The official x402 V2 exact EVM gateway communicates with the loopback facilitator using `HTTPFacilitatorClient`. The client signs EIP-712 `TransferWithAuthorization`; the local facilitator cryptographically verifies that signature and required token, recipient, and amount. Its settlement ledger is simulated. Standard PAYMENT-REQUIRED and PAYMENT-RESPONSE headers are decoded and checked. Exactly two successful billing settlements are recorded, one for each paid judgment.

The checkpoint requires Robinhood USDG billing for new deployment configuration. The proof uses the existing injected gateway boundary with Base USDC, while preserving that deployment configuration. This proves the shared handler/payment protocol boundary; it does not establish readiness of a deployed USDG facilitator.

The payer fixture key belongs solely to the external local infrastructure module. It is publicly known disposable test material, never assigned to Radar configuration. Radar holds only its judgment issuer key, which signs decisions rather than wallets or transactions.

External settlement is separately invoked through the local adapter's `/external-settle`. Radar reads `/rpc` using viem's HTTP transport and the existing production finalized-token-transfer verifier. This checks chain ID, transaction success/reference, canonical block hash, finality height, USDC Transfer decoding, sender, recipient, amount, and authorized timestamp. The execution signature binds the full proof, subject, and actual parent hash. The judgment fee transaction and execution transfer have distinct references.

## Persisted sequence

| Step | Boundary | Result |
| --- | --- | --- |
| Baseline | GET `/v1/score/provider_pay_sh_quartz` | Zero, no contributors, free |
| Observe | POST `/internal/receipt-spine/observation` | `phase5-observation-first`, current reviewed evidence |
| Quote | POST `/v1/pre-spend/check` | 402 challenge, no JudgmentReceipt |
| Judge | Paid retry of the same request | `proceed`, confidence 90, signed JudgmentReceipt |
| External settle | LOCAL adapter `/external-settle` | Synthetic finalized Base USDC Transfer |
| Execute | POST `/v1/execute-proof` | Verified ExecutionReceipt citing first judgment |
| Evaluate | Authenticated POST `/v1/evaluate` | `contradicted`, `score-policy.v1`, authoritative `-15` |
| Score | GET `/v1/score/provider_pay_sh_quartz` | `-15`, contributing evaluation identified, deterministic hash |
| Observe again | POST observation intake | `phase5-observation-second`, fresh sufficient evidence |
| Judge again | New paid POST `/v1/pre-spend/check` | `do_not_spend`, confidence 90, normal historical policy veto |
| Replay | Public chain inspector and new projection instance | Four hashes and full ancestry valid; same score/hash |
| Restart | Application close/reopen, public reads | Same persisted chain and projection |

The later judgment cites the new observation. Its reasons include `historical_execution_performance_degraded`, `derived_score_below_policy_threshold`, and `contradicted_evaluation_in_history`. Evidence is sufficient; the change is not an insufficient-evidence fallback. The second judgment is preserved historically while later stale/insufficient evidence correctly blocks new spending for free.

## Fail-closed evidence

The scenario records 21 negative attempts, each comparing every authoritative receipt and the derived projection before and after. Missing payment returns 402; malformed and cryptographically invalid payments return 400. A reused payment on another key returns 409 without another settlement. Judgment, execution, and evaluation key conflicts return 409. Identical execution/evaluation retries return the original receipt without a second contribution.

Execution negatives include a bad signature, signing against a corrupted parent hash, signing against a substituted subject, an incorrect transaction reference, caller-authored parent hash, cross-subject observation substitution, and duplicate execution authorization. Evaluator negatives include an unsupported signature, missing authentication, duplicate evaluation, and caller-authored score delta. Legacy reputation writes are rejected. Stale and insufficient observations yield `insufficient_evidence`, zero cost, no receipt, and no payment challenge even when a payment is supplied.

PostgreSQL rejects update/delete/truncate attempts on all four receipt tables. Separate inspector tests corrupt hashes, parent links, and subjects or remove a parent in an adversarial reader. Inspection withholds the projection and reports failed verification. No corruption fixture is used to manufacture a successful end-to-end receipt.

## Public UI proof

The existing Receipts page now includes a canonical receipt-chain inspector. Open `/receipts?evaluation=<evaluation_id>` against a database containing the chain, or enter the ID in its labelled form. It displays Observation → Judgment → Execution → Evaluation links, receipt hashes, parent verification, evaluation outcome/policy, derived score/hash, contributing evaluations, and the ordered judgment comparison. It uses existing Radar panel and control styles, accessible labels, status/error roles, native links, and wrapping hashes. No wallet or payment is needed to inspect it.

Public API: GET `/v1/receipt-spine/evaluation/:id/chain`. This endpoint only reads persisted records and reconstructs verified reputation. It does not issue receipts or author scores. Unavailable/corrupt parents fail verification and suppress the projection. UI coverage uses the repository's existing jsdom/React infrastructure. The production bundle was also inspected in the Codex browser at a narrow viewport using the captured LOCAL chain response; this is presentation QA, separate from the PostgreSQL-backed HTTP proof. A full external-browser automation suite is not installed in this repository.

## Authority and readiness

The four canonical receipt types and their append-only guards remain intact. EvaluationService is the only production emitter of nonzero score changes. Reputation reconstruction accepts only authoritative EvaluationReceipts with complete ancestry. Positive or negative history is consulted only after current sufficient evidence passes. Insufficient evidence remains free and cannot be upgraded by payment. Radar's execution boundary remains read-only with respect to external settlement.

The authority audit scans the entire production source tree. Its classified counts and all occurrences are included in `output/phase5/completion-report.json`; the required result is F = 0. Typecheck and lint are both the repository's configured TypeScript checks.

Remaining limitations: local deterministic settlement proves verifier behavior, not chain economics; external evaluator signatures remain unsupported and internal admin authentication supplies evaluator provenance; request/response content hashes are signed external claims rather than independently recomputed payloads; the public inspector currently scans subject-comparable judgments through the existing store list interface and should receive bounded indexed pagination before large public histories; local p95 does not establish distributed production performance. Controlled deployment preparation must separately review production RPC/facilitator trust, credentials, schema deployment, permissions, and observed live/testnet settlement. No deployment is authorized by this report.

See the completion report for measured results and the final PASS/FAIL gate. It is the authoritative summary of this run, including any failed validation attempts and machine contention.

## Final measured result

**PHASE 5: PASS.** The final source fingerprint remained unchanged throughout validation. Full suite: **1,883 passed, 0 failed, 0 skipped across 263 files**. Focused protocol/PostgreSQL/integrity/payment/execution/evaluation/UI suite: **108 passed, 0 failed, 0 skipped across 24 files**. Typecheck, lint, production build, and diff-check all passed.

The isolated benchmark measured **27.22 ms judgment p95**, **24.03 ms score lookup p95**, and **1.51 ms evaluation-write p95**, each over 300 samples after 30 warmups. Judgment history contained 100 evaluations and no competing compiler/test processes were present.

The source-wide authority audit returned **A=9, B=1, C=57, D=21, E=11, F=0**. All 21 negative scenarios preserved authoritative state. An independent offline replay used the report's publicly served issuer keys, verified both judgment signatures and all four receipt hashes/ancestries, rebuilt the exact score projection, and confirmed identical canonical hashes across independent scenario runs. The captured UI is in `output/phase5/ui-proof.jpg`.

An initial 30-second end-to-end test timed out while other chats were compiling and testing. Its disposable schema was removed. The new multi-step HTTP suite now has a 120-second timeout; individual existing test timeouts were not changed. Subsequent full validation runs passed. Early diagnostics remain in the output directory, distinct from the final evidence.

| Final gate | Result |
| --- | --- |
| PHASE 5 | PASS |
| Four-receipt chain | PASS |
| x402 local payment verification | PASS |
| External settlement proof | PASS — LOCAL deterministic RPC fixture |
| Evaluation sole authority | PASS |
| Derived reputation | PASS |
| Judgment feedback | PASS |
| Replay integrity | PASS |
| Fail-closed invariants | PASS |
| Full test suite | PASS |
| Judgment p95 under 100 ms | PASS |
| UI proof | PASS |
| Authority violations | F = 0 |
| Evidence classification | LOCAL |
| Ready for controlled deployment preparation | YES |

Production readiness assessment: the local protocol proof is complete and suitable for controlled deployment preparation. Production or testnet economic settlement, deployed Robinhood USDG facilitator operation, production database permissions/migrations, and external evaluator signature support remain unproved. No deployment, push, merge, or production migration was performed.
