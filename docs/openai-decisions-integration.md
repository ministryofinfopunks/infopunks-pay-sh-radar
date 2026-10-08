# OpenAI Decisions advisory integration (v1)

## Boundary and deployment state

The adapter calls the public-beta [`POST /v1/decisions`](https://developers.openai.com/api/reference/resources/decisions/methods/create) endpoint with `gpt-6-luna`. It accepts predicate, choice and score questions and emits versioned, normalized advisory results. Predicate `probability` is exposed as the local confidence-like value; choice and score use the endpoint's `confidence`. All probabilities and choices are validated. A refusal or malformed batch is unusable. The endpoint has no fixed published latency SLO or guaranteed confidence calibration.

`OPENAI_DECISIONS_SHADOW_ENABLED` defaults to `false`. When enabled, `createApp` injects an `OpenAIDecisionsAdapter` into a read-only comparison hook after the existing pre-spend service checks live, integrity-valid, fresh, scoped observation receipts and reviewed policy facts. `OPENAI_API_KEY` is required only for enabled shadow mode; `OPENAI_DECISIONS_TIMEOUT_MS` defaults to 1200 ms. Tests can inject an adapter without network access. When disabled, the existing judgment path makes no Decisions call.

The canonical decision, confidence, cost, x402 quote, settlement and receipt are calculated by Infopunks before the shadow hook. The hook has no write handle to receipt authority, budgets, signing keys, payment gateway, or reputation. Its only outputs are safe accounting and comparison log events. It cannot create an Observation, Judgment, Execution or Evaluation receipt. In particular, missing or stale evidence remains `insufficient_evidence`, free, and without a billable decision receipt. A model suggestion of `proceed` cannot authorize spend. Verified Evaluation receipt processing and score projections remain under existing deterministic authority.

The adapter sends a fixed question and a bounded JSON summary of reviewed facts. Text within those facts is explicitly treated as data. Unknown provider fields are discarded. Raw prompt text, credentials and signing material are absent from accounting events. A 200 response with missing confidence, mismatched answer names/types, invalid distributions, impossible score, or wrong model fails closed. HTTP 401/403, 429, quota exhaustion, 5xx, network errors and timeouts are classified. Shadow mode does not retry or block the judgment response; this bounds the hot path and prevents retry amplification. Failed inference still records an attempt, with unknown actual provider cost.

Accounting events record adapter/model, request hash, status, latency, attempts, token usage, baseline USD cost estimate and an explicit `actual_provider_cost_usd: null`. The estimate uses the [public-beta Decisions endpoint rate](https://developers.openai.com/api/docs/guides/decisions) of $0.10 per million uncached input tokens; output and cached input are excluded. Regional or long-context multipliers and invoice adjustments make actual cost unknown. Events are logs, not durable financial ledger entries or billable receipts. Future x402 monetization requires separate durable reconciliation, pricing and authorization review. Billing is not activated here.

## Jev and IPX integration checkpoint

The clean feature branch starts at committed `origin/main` (`55f05d6`). The Jev witness, economic engine and IPX launch files are currently uncommitted in a different checkout; an A2 worktree also changes judgment and receipt files. This branch does not cherry-pick those checkpoint or IPX changes. After those dependencies reach a clean, reviewed base, connect the versioned advisory result as a second provider at the economic engine's injected provider seam. Keep Jev as the default and select Decisions only under an independent flag. Feed either provider's suggestion into the deterministic Judge; never map a provider response directly to an authorization or receipt. Preserve migration 014–018 ordering and all frozen IPX call/signature/hash invariants. This future merge is a separate review gate.

## Reproduction

```sh
npm ci
npm run typecheck
npm run lint
npm run test -- --maxWorkers=4
npm run build
npm run benchmark:decisions-shadow -- --mock --output docs/decisions-shadow-benchmark-2026-10-08.json
git diff --check
```

The mock benchmark exercises metrics and host gating, but cannot establish live provider quality, latency or account availability. A live run requires an authorized API key and explicit `--live`. It sends the synthetic fixture text to OpenAI and incurs API usage. Do not enable paid judgment billing, payment execution, or deploy the flag without independent review.
