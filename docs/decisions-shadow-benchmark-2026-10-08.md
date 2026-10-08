# Decisions shadow benchmark — 2026-10-08

## Method

Eight synthetic policy regression cases were assembled from the committed pre-spend and receipt tests. Their expected outcomes are deterministic host policy labels, not independent human semantic labels. One case deliberately contains an adversarial instruction in untrusted evidence text. The reproducible command is `npm run benchmark:decisions-shadow -- --mock --output docs/decisions-shadow-benchmark-2026-10-08.json`; the JSON includes fixture and input SHA-256 hashes and per-case results. `--mock` uses a local deterministic transport. No OpenAI request, payment, billing activation or financial transaction occurred.

## Mock harness result

| Metric | Result | Interpretation |
| --- | ---: | --- |
| Fixture cases / provider answers | 8 / 8 | Mock transport coverage only |
| Accuracy against synthetic labels | 7/8 (87.5%) | Harness calculation, not model accuracy |
| Unsafe model approval suggestions | 1 | Deliberate adversarial mock case |
| Unsafe host approvals | 0 | Deterministic evidence gate held |
| Disagreements with current evaluator | 1 | Deliberate adversarial mock case |
| Input / output tokens | 271 / 40 | Simulated usage fields |
| Baseline estimated provider cost | $0.0000271 | Simulated usage at public-beta base rate; not incurred |
| Actual provider cost | Unknown | No provider invoice or live call |
| Live p50 / p95 / p99 latency | Unmeasured | Mock timings in JSON are local harness timings only |
| Independently labeled accuracy and unsafe approval rate | Unmeasured | No independent corpus exists |

The exact mock p50/p95/p99 values are retained in JSON to verify percentile calculation; they are not provider latency measurements. The existing PostgreSQL score benchmark measures a different path and cannot substitute for Decisions network measurements.

## Validation and audit evidence

On isolated branch `codex/openai-decisions-shadow` from `origin/main` commit `55f05d6`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --cached --check` passed. `npm run test -- --maxWorkers=4` passed with 235 test files and 1,744 tests; 2 files and 9 tests were skipped by the existing suite. After a final timeout-classification fix, the focused adapter and integration run passed 14 tests and typecheck passed again. `OPENAI_API_KEY` and the dedicated PostgreSQL test URLs were absent from this environment, so no live provider or database durability run was possible. The dirty main checkout and active A2 worktree were not modified.

## Recommendation

**NO-GO for live activation or billing.** The adapter and shadow path are ready for code review, but the Jev/economic dependency has no clean committed base, account access has not been verified, and live model quality, unsafe suggestions, tail latency and actual cost are unmeasured. Keep the flag off. Before activation, merge the Jev dependency through a separate review, collect independently labeled cases, run a credentialed shadow benchmark, and review payment/accounting changes separately. The existing IPX launch critical path and migration numbering remain untouched.
