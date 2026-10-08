# Decisions live qualification runner

Status: **ready for an authorized dedicated test project; no live run has been made.** This runner calls the existing `OpenAIDecisionsAdapter` directly. It has no payment, receipt, budget, signing, settlement, or reputation dependency. It never enables `OPENAI_DECISIONS_SHADOW_ENABLED`. The qualification corpus is synthetic and uses deterministic policy replay labels; its `reviewer_status` travels into every report. Human review is still required before treating labels as independent operational evidence.

The runner also accepts a separate `decisions-reviewed-benchmark.v1` dataset after the [independent-label protocol](decisions-independent-label-review-v1.md) is complete. Each reviewed case contains a pre-spend `model_context` and its SHA-256, while the resolved label, recorded policy decision, verified outcome, and evidence-record hashes remain scoring metadata. Only `model_context` is serialized into the provider request. Before dispatch, the runner checks request-to-observation intent and subject binding, reviewed source/fact shape, budget, route, settlement, ingestion order and freshness at the frozen judgment time. Full receipt and external outcome verification remain separate prerequisites. The CLI requires `DECISIONS_BENCH_REVIEWED_DATASET_SHA256` to equal the exact dataset file hash before a live reviewed run. A self-declared digest does not replace independent review; the external review and staging gates still apply. No reviewed historical dataset exists in this checkout because the canonical receipt database and evidence artifacts are not available.

## Safe preflight

Use a dedicated OpenAI project and API key that can reach `POST /v1/decisions`, and set a hard project spend limit in OpenAI before running. Confirm the project's **remaining** budget separately. The runner's local request, token, and USD ceilings are a second guard: local token reservation uses serialized UTF-8 bytes plus 1,024 tokens per request and a configured price ceiling. Client estimates cannot enforce an account invoice cap, especially on failed calls with missing usage or changed regional and long-context prices. The external project hard limit is required. Review the [current Decisions pricing](https://developers.openai.com/api/docs/guides/decisions) and set `--price-ceiling-usd-per-million-input` above the highest rate applicable to the project; the published base is $0.10 per million uncached input tokens, with no output or cache charges.

Set these variables in a dedicated test shell or secret store; do not put the key on the command line or in the corpus:

```sh
export DECISIONS_BENCH_ENV=dedicated-test
export DECISIONS_BENCH_TEST_ENV_ID='<dedicated staging environment identifier>'
export DECISIONS_BENCH_PROJECT_ID='<dedicated OpenAI project identifier>'
export DECISIONS_BENCH_PROJECT_HARD_LIMIT_USD='<confirmed project hard limit>'
export DECISIONS_BENCH_PROJECT_REMAINING_USD='<confirmed remaining project budget>'
export DECISIONS_BENCH_PROJECT_CAP_CONFIRMED=yes
export DECISIONS_BENCH_API_KEY='<dedicated project key from secret store>'
# For an independently resolved historical dataset only:
# export DECISIONS_BENCH_REVIEWED_DATASET_SHA256='<sha256 of the exact approved dataset file>'
npm run benchmark:decisions-live -- \
  --corpus tests/fixtures/decisions-qualification-cases.json \
  --output decisions-live-local.json \
  --max-requests 19 \
  --max-input-tokens 100000 \
  --max-usd 0.05 \
  --price-ceiling-usd-per-million-input 1 \
  --timeout-ms 3000
```

`--output` must point to a new file; the runner reserves it with owner-only permissions before the first request. It will not overwrite a previous benchmark or the corpus. An unexpected fatal error can leave an empty reserved file, preventing an accidental duplicate paid run. Do not commit a live output without reviewing its metadata and your organization's data policy. `DECISIONS_BENCH_API_KEY` is intentionally separate from the application `OPENAI_API_KEY`. The CLI requires all caps and the dedicated environment declaration before making a call. A live transport cannot be replaced with an injected mock. Test code injects a test transport and labels reports `test-double`.

## Reading the report

The report records the corpus hash, case categories, policy replay labels, provider suggestions, failures, confidence, token usage, and hashes of requests and dedicated environment identifiers. It omits raw input, raw provider output, key values, and untrusted challenge text. `provider_accuracy_all_attempted` counts refusal and failure as incorrect; `provider_accuracy_answered` excludes them. False approvals count `proceed` suggestions on labels other than `proceed`. `deterministic_policy_disagreements` compares with replayed policy labels, while `real_world_evaluator_disagreements` stays null until staging data exists. Calibration is a Brier score for `proceed` probabilities on answered cases only. Metrics are split by category and preserve corpus reviewer status.

`observed_round_trip_ms` measures client request dispatch through body parse, including network, provider queueing and inference. `adapter_latency_ms` includes adapter validation and normalization. `adapter_overhead_ms` estimates the extra time inside the adapter, and `harness_overhead_ms` is measured outside it. Internal model-only latency is unknown and recorded as null; the client cannot infer it from elapsed time. Failed calls with no usage leave reported token totals and baseline cost null, while local cost reservation remains visible. `actual_provider_cost_usd` is always null pending independent invoice reconciliation. A local ceiling violation after returned provider usage stops further calls but cannot undo a completed call.

The runner sends every corpus case, including those marked `production_shadow_eligible: false`, to probe unsafe suggestions in an isolated offline test. Staging shadow traffic must instead follow the application's verified evidence gate. A provider suggestion here is never a host authorization. No production decision, receipt, payment, or reputation event is written by this runner.

## Reproduction without provider access

`npm run typecheck`, `npx vitest run tests/unit/decisions-live-benchmark.test.ts`, and the existing `benchmark:decisions-shadow -- --mock` exercise the parser, local caps, metrics, transport labels, and failure accounting without API credentials. They do **not** establish live accuracy, latency, reliability, actual provider cost, or staging safety. Live qualification remains blocked until the dedicated key, test environment, hard project limit, and reviewer sign-off are available.
