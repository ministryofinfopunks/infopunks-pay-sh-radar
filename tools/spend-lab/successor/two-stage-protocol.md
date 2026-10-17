# Two-stage economic assurance / exploratory protocol v1

**Hypothesis, not commercial validation. HOLD. No authorization or approved fee changes.**

Radar should be assessed by incremental Net Judgment Value rather than paid request volume:

`Net Judgment Value = Losses Prevented − Opportunity Lost − Judgment Cost`

Losses and missed opportunities use net provider outcomes, including provider price and fees; those costs are not subtracted a second time as judgment costs. Report each task and each preregistered risk category, retaining negative results, false blocks and correct abstentions. The no-Radar arm remains the counterfactual reference, not a claim of what would have happened in a live market.

## What this experiment changes

Layer 1 is a deterministic local preflight over the registered provider/task, bound price/fees, evidence freshness, evidence sufficiency and hard veto. Missing, stale, mismatched or insufficient evidence returns no-spend without calling the paid route. An explicit hard veto also stops before payment. Preflight produces no signed paid judgment, execution capability or provider action.

Layer 2 retains the existing approved simulated fee, SDK verification, signed canonical judgment and separate execution capability. Every possible execution still passes this layer. A cheap, qualified call does **not** automatically bypass required judgment. Preflight qualification does **not** mean payment approval or execution approval.

There is no calibrated estimator establishing when additional full assessment can materially change a spending decision. The current full assessor consumes substantially the same fixture evidence. Economic relevance, incremental information gain and willingness to pay remain unmeasured; the experiment cannot use its revealed outcome labels to decide who should have been charged. Qualification is therefore followed by the required full judgment, with that limitation recorded explicitly. Economic gating of Layer 2 is a future experiment, not a deployed feature.

## Registration and outcome grounding

`two-stage-cli.ts` writes `registration.json` before running either arm. It freezes policy, risk strata, task/provider snapshots and their digests. It then runs the unchanged fixed-fee control and the conservative two-stage treatment in separate disposable directories. Each retains the existing evaluator's label commitment before decisions and reveal after frozen decisions. No labels or Radar verdicts enter preflight routing.

Both arms use the same 20 actual local implementations and the same independently implemented task oracle. The suite was inspected during the preceding experiment. This is explicitly **exploratory reuse**, not a fresh blind holdout or 40 diverse provider profiles. Task correctness is independently calculated; utilities, fees, probes and risk categories remain authored local assumptions. No independently collected market/economic dataset is introduced.

Risk categories are frozen by policy before labels:

- `integrity_sensitive`: cryptography, decimal accounting, relational joins and validation families.
- `higher_exposure`: other calls with provider price plus fee at least 10 toy units.
- `routine`: remaining calls.

These are simulation strata, not validated commercial risk classifications. Category sample sizes are reported, not presented as statistically representative populations.

## Measurement and missing costs

`fixed-fee-net-value.json` and `two-stage-net-value.json` contain per-task and per-risk-category values. Prevented losses and opportunity lost are derived from the actual no-Radar delivery scored against the independent task oracle, not authored expected Radar verdicts. Report `outcome_variation_residual_units` when actual paired outcome differences prevent the simple decomposition from accounting for the entire paired delta; do not hide that residual.

`fee_only_net_judgment_value_units` subtracts the simulated fee. `fully_costed_net_judgment_value_units` remains **null**, because preflight compute, inference, verification, reconciliation, infrastructure and latency opportunity costs are not independently monetized. Missing costs are not zero. Preflight and total latency are measured separately. Audit/setup cost remains disclosed in each underlying benchmark.

The existing comparison remains **46 − 62 − 17 = −33 toy units**. The conservative treatment is expected to avoid six paid hard-veto assessments while leaving execution decisions unchanged: **46 − 62 − 11 = −27 fee-only toy units**. This is still negative. Any measured improvement is fee avoidance on already identifiable no-spend cases; it does not establish better judgment accuracy or useful incremental full assurance. Preserving the same false blocks is not evidence that those blocks are acceptable.

The summary also reports the additional preflight cost per request that would exhaust fee savings. It is a sensitivity bound under assigned toy fees, not a measured operating cost, price recommendation or break-even commercial claim.

## Reproduce and review

On the exact clean candidate head using Node 24.21.0:

```sh
npx vitest run tests/spend-lab-value.test.ts tests/spend-lab-successor.test.ts
npx tsx tools/spend-lab/successor/two-stage-cli.ts .data/first-spender-two-stage/experiment
```

Use a new output directory. Inspect `registration.json`, both underlying signed label commitments/reveals, frozen decisions, and the two Net Judgment Value files. CI preserves the same exact-head source checks and uploads an allowlist of simulation diagnostics. It excludes private keys, SDK proofs, databases and raw receipt archives.

## Next commercial test, before any product conclusion

Collect a separately curated provider/task population with independently sourced outcome evidence and economic valuations, covering low-cost known calls, meaningful exposures, uncertain providers and mixed failure modes. Split calibration and held-out evaluation by provider/task family before inspecting outcomes. Freeze risk strata, assurance requirements, fee approval and an incremental-value routing rule using calibration data only. Required judgments remain mandatory unless a separately approved policy explicitly permits another safe path.

Full assessment must have distinct evidence or analysis capable of changing a qualified preflight decision; otherwise this experiment cannot identify its incremental assurance value. Compare no Radar, fixed full judgment and the frozen two-stage policy on matched held-out tasks; include no-spend actions, all fees and amortized computation, false blocks, prevented losses, latency and opportunity costs. Report uncertainty and category sample sizes, including negative categories. Only independently grounded, fully costed results could support a commercial usefulness claim.

Staging, real purchases, wallet/remote payments, public payments, production, external proof publication, merge and deployment remain **HOLD**. External independent review and the repository's human visual approval remain pending.
