# FIRST SPENDER R2 / Economic Value Qualification

**HOLD. Real economic usefulness: NOT ESTABLISHED.** Local same-operator synthetic analysis only. No staging, production, wallet, real payment, release-gate change, merge or external publication. The only submission is a draft successor to PR #16 at `9712fa304751565fac998460eca030d6247d4a1e`.

The original PR #15 reports, PR #16 source and reviewer baseline, frozen evidence trees, application and execution/payment policy are unchanged. `source-manifest.mjs` rejects any successor diff outside this R2 directory, its test and its offline CI workflow, verifies frozen source-tree equality, and binds the heldout files to the earlier curation commit. Holdout labels were committed before policy code, then strategy/cost/grid definitions were preregistered in a second commit. Neither is tuned after evaluation.

From an exact clean checkout, Node **24.21.0**:

```sh
npm ci
node tools/spend-lab/value-r2/source-manifest.mjs .data/value-r2/source-before.json
npx tsc --noEmit
npx tsc -p tools/spend-lab/tsconfig.json
npx vitest run tests/spend-lab-value-r2.test.ts tests/spend-lab-successor.test.ts tests/spend-lab.test.ts tests/economic-judgment-engine.test.ts tests/economic-engine-api.test.ts tests/judgment-dx-sdk.test.ts tests/pre-spend-sdk.test.ts tests/unit/judgment-service.test.ts tests/decision-context.test.ts tests/integration/pre-spend-judgment.test.ts tests/integration/pre-spend-payment.test.ts
npx tsx tools/spend-lab/value-r2/cli.ts .data/value-r2/evaluation
npx tsx tools/spend-lab/value-r2/verify-retained.ts .data/value-r2/evaluation
node tools/spend-lab/value-r2/source-manifest.mjs .data/value-r2/source-after.json
```

Output directories must be fresh. No `.env` or credentials are needed. The evaluator freezes offers-only preferences from a sanitized child process before loading holdout labels for scoring. The pure policy imports no dataset, oracle or outcomes. The parent and OS user are shared; this is an auditable information flow, not an adversarial secrecy boundary. The local curator is separately organized, not externally independent.

Four primary comparisons: no Radar; simple static/declared-margin checks; cheap deterministic preflight; full simulated paid canonical Radar judgment. All are non-executable counterfactual preferences. Shared recipient/rail/budget rules apply; no preference is an authorization. A fifth, explicitly secondary **reject-only staging proposal** screens cheap failures before the unchanged Radar gate. It can only remove an execution preference, cannot turn a veto/insufficiency into permission, and never supplies a capability or skips actual executor checks. No production optimization is installed.

Development retains all original 20 measured provider tasks and their −33-unit result. Holdout has 96 synthetic artifacts from eight new contract families and twelve conditions. Expected output keys were curated separately; a reference implementation recomputes correctness. All identifiers, labels, outputs, observed synthetic duration bins and price/fee/value/loss assumptions are committed. The holdout is a balanced stress set, not a sampled provider population. Family conditions share inputs; 96 rows are not 96 independent market observations. No statistical market confidence interval is inferred.

Primary full Radar decisions replay the unchanged `assessFrozenDecision` with the branded local-simulation provenance domain. All 96 base holdout dispositions/payment flags are checked against the actual localhost SDK/x402 route with simulated non-EVM payment proofs. Pure replay retains stale and absent-provenance negatives; the transport seed maps those to insufficient evidence rather than claiming it independently observed stale records. Sensitivity cases are pure source replay and economic accounting, not 7,560 paid HTTP/real-provider experiments. No holdout service is executed. Existing PR #16/legacy lifecycle tests qualify simulated execution/replay/recovery independently.

Each split has 3,780 preregistered settings across judgment fee, risk exposure, transaction scale, task value and evidence degradation. Provider prices, fees, values, downside and service budgets scale together for transaction-size sensitivity; judgment/check costs stay absolute. Task-value sensitivity changes declared value, allowing static margin checks to re-evaluate. Risk scales only modeled downside on a failed/late result. Evidence scenarios only remove, expire or weaken evidence; none lifts a veto or invents improved authority. Every setting is retained, including ties/negative results. A grid cell is not a statistical sample or a recommended policy. Subsequent tuning needs a fresh holdout.

Costs: simulated qualified judgments map to one toy unit by default, including paid BLOCK; insufficient evidence stays free. Static checks cost 0.05 and a cheap probe 0.2 modeled units when reached; these are explicit assumptions, not measured infrastructure invoices. Development probe flags are source-authored health/SLO declarations for the fixed local implementations, not borrowed target-output correctness or independently observed pre-purchase endpoint guarantees. Holdout probe flags were frozen as synthetic metadata before policy evaluation. Cheap probe access is assumed available without a provider service purchase; its availability/price must be externally validated. Failed delivery retains actual modeled charge and fees. Audit/setup costs and latency are separate from per-intent modeled utility. The wire `.01 USDC` is simulation metadata, never a conversion rate or live payment. Actual fee/value/infra/latency opportunity costs remain unknown. A net toy-unit score is not real profit.

Reviewer entry points: [economic report](reports/economic-value.md), [case-by-case ledger](reports/development-case-analysis.md), [provenance audit](reports/provenance-review.md), [pilot dossier](reports/pilot-dossier.md), plus regenerated `summary.json`, both complete per-case comparison files, both complete sensitivity grids, frozen preferences, HTTP checks, provenance vectors and source manifests. Private SQLite identities, keys, SDK proofs and raw receipt archives remain excluded from submission/artifact allowlists.
