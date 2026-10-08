# Decisions shadow qualification review — 2026-10-08

## Decision

**NO-GO for live activation, spend influence, billing or deployment.** The adapter and guarded benchmark runner are reviewable, and the canonical shadow hook cannot change a judgment. Qualification still lacks a dedicated OpenAI test key, staging environment, externally reviewed labels, live provider measurements and independently verified Evaluation outcome evidence. The user confirmed that neither credentials nor staging are currently available. The feature flag remains off.

## Provenance and scope

The original Decisions checkpoint is `62380c06` on `codex/openai-decisions-shadow`, based on `55f05d6`. The integration candidate is a separate worktree based on committed mainline `dfe089b`, with the Decisions feature, corpus and runner cherry-picked onto `codex/decisions-integration-candidate`. It does not modify the main checkout or unfinished IPX worktrees. The candidate makes no migration, IPX contract, signing, billing, settlement or execution changes.

The [official Decisions API reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) specifies the typed answers and per-question refusals used by the adapter. The [Decisions guide](https://developers.openai.com/api/docs/guides/decisions) lists `gpt-6-luna` as the public-beta model and $0.10 per million uncached input tokens before applicable multipliers. Published documentation provides no model-only latency guarantee or confidence calibration guarantee.

## Authorization and receipt audit

| Boundary | Evidence | Qualification state |
| --- | --- | --- |
| Pre-spend evidence | `judgmentService.ts` checks receipt hash, subject and intent binding, reviewed live provenance, freshness, proof refs, route, settlement and budget before shadow invocation. | Missing, stale, mismatched and unreviewed evidence cannot produce `proceed`; insufficient evidence stays free with no paid judgment receipt. |
| Model authority | `decisionsJudgmentShadow.ts` receives only reviewed policy facts and emits comparison/accounting data. `app.ts` injects it only under a default-off flag. | Model output cannot enter policy, x402 settlement, signing, or O→J→X→E writes. A disagreeing answer and disabled flag have route-level regression tests. |
| Receipt ancestry | `receiptAuthorityService.ts` checks O→J, J→X and X→E parent hashes and historical timing; canonical storage and migration 011 enforce append-only and parent links. | Existing parent and immutability regressions remain required for the candidate. |
| Reputation | Mainline `EvaluationService` requires internal evaluator provenance and computes deltas, but its outcome evidence refs can be arbitrary strings; score projection counts authority-valid E records. | **Open blocker:** outcome truth is not independently verified. A2 has separate score-eligibility commits and migration 019, but still requires outcome attestation review. No model shadow output writes E or scores. |

The Jev economic engine is not wired to Decisions. `EconomicJobSchema.model_id`, `JevWitnessSchema.source`, `EconomicEngineOptions.provider`, `requestJevWitness` and `judgeEconomicDecision` bind the current provider to Jev's envelope and response format. A provider-neutral witness mapper requires a separate versioned schema, evidence binding and Judge review; direct substitution would be unsafe. Jev remains the existing default.

## Corpus and measurements

The [qualification corpus](decisions-qualification-corpus.md) contains 19 policy-derived cases: 3 valid approvals, 5 insufficient-evidence cases, 3 provider mismatches, 2 stale observations, 2 manipulated inputs and 4 denied actions. Labels were fixed from deterministic rules before provider output. Replay tests verify each label, free/paid behavior, and shadow eligibility. Nine cases reach the production shadow callback; ten are offline adversarial challenges withheld by the evidence gate. `reviewer_status` is `pending_external_review`; these are not independently adjudicated production outcomes.

The [19-case test-double artifact](decisions-qualification-test-double-2026-10-08.json) exercises report calculations and local caps. Its one unsafe approval suggestion is deliberately injected for a manipulated-input case; its 18/19 agreement, Brier score, token usage, cost estimate and p50/p95/p99 are **mock harness values**, not OpenAI quality, performance or expense. The earlier 8-case mock remains a historical baseline and is not combined with this result. Live model quality, false approvals, calibration, reliability, round-trip latency, model-only latency and actual provider cost are unmeasured. The live runner always records model-only latency and actual invoiced cost as unknown until separately established.

The [guarded runner](decisions-live-qualification-runner.md) requires a dedicated key, dedicated test environment, externally confirmed project hard cap, and explicit request/token/USD/timeout ceilings. It reserves the output file before any paid request, emits hashes rather than raw prompts or secrets, and has no financial-execution dependency. It distinguishes observed API round-trip, adapter overhead and outer harness overhead. Its local budget is a secondary guard; only the external project hard limit can bound charges after a client crash or missing usage response.

## Reproducible validation

On the integration candidate, `npm run verify:decisions-corpus` passed 20 tests and the targeted adapter, corpus, runner and shadow integration run passed 41 tests. The full `npm run test -- --maxWorkers=4` run passed 1,896 tests across 255 files, with 19 environment-gated tests skipped. `npm run typecheck`, `npm run lint`, and `npm run build` passed. A disposable local PostgreSQL database then ran eight focused receipt, migration, score, payment and economic durability files: 16 tests passed. This is local regression evidence, not staging shadow evidence.

The live CLI was invoked without dedicated credentials. It exited before network activity and created no output report. The 19-case test-double benchmark is reproducible with `npm run benchmark:decisions-qualification-mock`; its artifact identifies the fake transport and has no live performance claims. No OpenAI request, payment, signing, settlement or deployment was performed.

## Activation gates

1. An independent reviewer signs the frozen corpus labels and sampling plan without seeing model answers; add consented, de-identified, verified outcome cases.
2. Establish trustworthy Evaluation outcome attestation and score eligibility, review the A2 lineage and migration 019 as a separate dependency, and repeat parent-pointer and append-only replay tests.
3. Provide dedicated Decisions credentials and staging infrastructure with a verified project hard cap. Run the 19-case benchmark and a representative shadow traffic window; reconcile actual invoice cost.
4. Set predeclared false-approval, calibration, availability, tail-latency and unit-economics thresholds, then compare live results to deterministic heuristics and Jev on the same eligible cases.
5. Review the provider-neutral Jev seam separately. Obtain explicit approval before any spend influence, billing, signing, settlement or production deployment.

Until these gates pass, keep `OPENAI_DECISIONS_SHADOW_ENABLED=false` and leave all payment and economic authorization flags unchanged.
