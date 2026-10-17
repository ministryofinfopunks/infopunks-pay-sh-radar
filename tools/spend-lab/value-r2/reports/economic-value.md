# FIRST SPENDER R2 — economic value qualification

**HOLD. Real economic usefulness is NOT ESTABLISHED.** In the preregistered base assumptions, full Radar loses incremental toy utility on both development and holdout. The grid contains conditional savings relative to weak spending baselines, but **no cell beats all three reference strategies and abstaining entirely while retaining positive net value**. There is no supported general “tiny fee pays for itself” claim here.

## Reviewer baseline and independent truth

This is an isolated successor to PR #16 at `9712fa304751565fac998460eca030d6247d4a1e`. PR #15, PR #16, application source, execution/payment rules, release gates and historical qualification evidence are preserved. The source manifest verifies tree equality and a strict change allowlist. No merge, deployment, wallet access, live payment or external proof publication occurred.

The 96-case holdout was committed at `d4bb90eb` before any R2 policy evaluator, with label commitment `sha256:48eb66b508825a2ff1cd9713c92d587d0443e9ff47b104e9d906f8f67c3f59ad`. Strategy definitions, costs and the entire sensitivity grid were preregistered at `9b023d44` before evaluation code. All files remain immutable under verification. These are local separate-track answer keys and synthetic delivery artifacts, not independently administered external economic truth. The human explicitly authorized this local curation track. No policy was tuned after inspecting holdout results.

Development retains the original 20 measured local provider tasks. Holdout uses eight different contract families, twelve predeclared conditions and 96 cases, with new inputs/providers. Conditions share family inputs, so 96 is not an independent market sample. Its durations, price/fee/value/downside mix, evidence imperfections and valuations are authored assumptions. A separate reference module checks answer keys. The offers-only child process cannot receive truth fields through its strict input schema; all preferences are hashed and saved before the scorer loads holdout labels. Shared source/OS visibility is disclosed, not presented as a secret or externally controlled holdout. Both complete case ledgers and every sweep cell are retained; no favorable-case filtering or pooling is used.

## Primary results

All scores below are toy utility units, after incurred modeled service costs/fees and specified check fees. Loss exposure on failed or late outputs is included in the holdout. Actual money, infrastructure invoices, independent valuations and monetized latency costs are unknown. Numbers are not currency or real profit.

| Strategy | Development, 20 tasks | Difference vs no Radar | Holdout, 96 cases | Difference vs no Radar |
|---|---:|---:|---:|---:|
| No Radar | 101 | 0 | −280 | 0 |
| Simple static/margin checks | 106 | +5 | −156.8 | +123.2 |
| Cheap deterministic preflight | 121.2 | +20.2 | 227.2 | +507.2 |
| Full paid Radar | 68 | **−33** | −368 | **−88** |
| Reject-only preflight → unchanged Radar, secondary proposal | 91.2 | −9.8 | −108.8 | +171.2 |

All strategies share recipient, supported-rail and service-budget admissibility. No Radar adds no judgment. Simple checks additionally use verified-identity/quote flags and positive declared value over price/fee. Cheap preflight adds predeclared reachability/schema/latency metadata. Full Radar uses unchanged canonical assessment, evidence and veto rules; every qualified paid verdict costs one unit, including BLOCK, while insufficient evidence is free. Static checks cost 0.05 per intent and cheap probes 0.2 when reached. These check/probe prices and free probe availability are modeling assumptions, not measured provider terms. No check can produce a wallet capability; all strategies are non-executable counterfactual preferences, not interchangeable production authorization modes.

The original deficit is **46 losses prevented − 62 gains missed − 17 judgment fees = −33**. The [complete 20-case analysis](development-case-analysis.md) explains the three economic false blocks, all six correct abstentions, five accepted negative deliveries and every fee. Two false abstentions are safety-correct responses to insufficient evidence; the other false block follows a supplied hard veto. They cannot be fixed by treating observed profit as permission.

The holdout deficit is **864 losses prevented − 896 gains missed − 56 judgment fees = −88**. Full Radar has 32 economic false blocks and 24 correct abstentions relative to admissible no-Radar preferences. Eight intentionally out-of-scope rows are excluded from every strategy's spend preference, but stay in the case denominator; a profitable prohibited transaction is not counted as a recoverable gain. No holdout service was executed. Full base holdout decisions/payment flags were validated against 96 actual localhost SDK/canonical HTTP checks, including 56 simulated judgment payments and zero mismatches. Synthetic artifact value is scored offline; there is no claim of 96 verified external purchases.

The secondary reject-only pipeline improves on full Radar by **23.2** development units and **259.2** holdout units, yet still trails cheap preflight and misses all the same profitable evidence-blocked tasks. Holdout incremental benefit +171.2 relative to no Radar still leaves **negative absolute utility −108.8**. Abstaining entirely yields zero with no service or judgment fees. Reducing a loss is not evidence that this policy should spend.

## Conditions for value and sensitivity

For an admissible task population, incremental value must satisfy:

`avoided service/downside losses − foregone profitable opportunities − judgment fees − extra probe/verification/infra/latency/recovery costs > 0`.

It must also exceed the best feasible cheap alternative and abstention, with independently supported assumptions. A low fee alone does not fix poor evidence discrimination or false blocks. At the base mix, the development break-even fee is **−16/17**, and holdout **−32/56** units per paid judgment. Both are negative; no nonnegative judgment fee yields positive incremental utility for full Radar in either base mix. Zero fees leave deficits of 16 and 32 respectively.

The complete grid contains 3,780 cells per split (7,560 total): seven judgment fees, five downside-risk multipliers, six transaction scales, three task-value scales and six evidence conditions. All cells are reported; changing fees is counterfactual economics, not a changed on-wire x402 price. Evidence conditions are recorded evidence, deterministic 25%/50% removal, all missing, all stale and confidence reduced by 20. They never invent fresh evidence or clear vetoes. Transaction scales multiply service prices, provider fees, task values, loss exposure and service budgets together while check fees stay fixed. Task-value scaling independently changes declared value and static margin decisions. Risk scales only failed/late downside. The original development tasks declare no extra downside, so their risk multiplier does not fabricate one.

| Split | Positive incremental vs no Radar | Negative vs no Radar | Tied | Beats all spending references | Beats references **and zero-cost abstention** |
|---|---:|---:|---:|---:|---:|
| Development | 1,065 | 2,715 | 0 | 195 | **0** |
| Holdout | 2,051 | 1,729 | 0 | 1,349 | **0** |

These are deterministic descriptive grid counts, not success probabilities, population frequencies, p-values or independent experiments. Baseline preferences can become very loss-making in high-risk cells; beating them while still losing money is not a deployment case. For example, with recorded holdout evidence, unit transaction/value scale and fee 1, risk 2 gives full Radar **−672** utility and **+552** relative to no Radar; risk 5 gives **−1,584** utility, **+2,472** relative to no Radar and **+908.8** over the best spending reference. Both lose to abstaining.

For that recorded holdout mix, the incremental equation at transaction scale `s`, failed-output risk `r` and judgment fee `f` is **s × (640r − 672) − 56f**. Full Radar can reduce baseline loss when **r > (672 + 56f/s)/640**, approximately **1.1375** at s=f=1. Its actual modeled net then remains **s × (−8 − 304r) − 56f** for unit task value, which is negative for nonnegative risk/fee. This identifies a conditional loss-reduction regime, not a positive absolute-value proposition. At general task-value multiplier `v`, compare its net **s × (520v − 528 − 304r) − 56f** against all alternatives; the grid finds no regime where full Radar is the best positive option. External data may differ, but this work supplies no evidence to assume it will.

Cheap preflight's apparent advantage also needs scrutiny. At the base mix, its benefit over full Radar disappears if its per-probe modeled price reaches **3 units** on development (19 probes), or **7.64 units** on holdout (80 probes), keeping other assumptions fixed. Its observed/declared flags may be optimistic or correlated with known failure types; real free probes may not exist. These are algebraic cost break-evens, not provider-price recommendations. Actual additional overhead and quote expiry can only narrow a claimed value window unless independently offset by measured benefit. Original provider audit/setup cost is disclosed separately; it is not hidden inside an assumed zero-cost intelligence network.

## Safe optimization and provenance

The sole proposed optimization is reject-only staging of static checks and cheap preflight **before** requesting the unchanged canonical judgment. It cannot promote an old veto, accept insufficient/stale/unverified authority, lower confidence, reinterpret `test_spend_first`, reuse an expired quote or turn fee payment into execution permission. It does not implement a live routing strategy, permission cache, new executor, release switch or production policy. Successful future execution still requires the original separate signed capability, exact recipient/operation/delegate/audience, current evidence/policy, budget reservation, expiry, durable idempotency/replay controls and fail-closed recovery. The offline preference objects always say `execution_authorized: false`.

The R2 invariant tests cover every holdout offer and all evidence modes, plus confidence/veto/scope negatives, label tampering and frozen-decision edits. The preserved canonical/SDK/controller tests cover actual simulated missing/forged capabilities, expiry, replay/concurrent execution, malformed authority, corrupt storage and crash/reconciliation paths. Byte-identical production/controller source is verified; R2 does not claim a new production optimization has been deployed or independently approved.

A separate [provenance audit](provenance-review.md) identifies legacy absent authority fields accepted by the current live predicate. This is a release-review blocker, not repaired by the economic score. Strict diagnostic vectors live only in tools. Actual production record prevalence is unknown; no database was accessed. An independent data/security/migration review must distinguish historical integrity from new-spend admissibility, quarantine ambiguous intake for new decisions and reattest without rewriting history.

## Independent review and pilot readiness

Local validation on Node 24.21.0: **175 tests passed across 11 files**, root/server/lab TypeScript checks passed, and the 96 base holdout HTTP/payment dispositions matched canonical replay. Source preservation, immutable holdout/preregistration ancestry, complete accounting and non-executable reject-only composition are checked. CI regenerates all results from the exact PR head; source manifests bind the implementation and retained evidence. These are engineering checks, not independent release/economic approval.

The [restricted-live dossier](pilot-dossier.md) identifies unassigned reviewers, provider selection, independent custody/evaluator requirements, proposed limits and stop/reconciliation controls. It authorizes nothing. Independent external evidence, admissible provenance, independently administered labels/valuations, actual comparator/operational costs and all existing release approvals remain missing. Do not replace them with more repetitions of these cases or select only favorable grid cells. Real economic usefulness remains **NOT ESTABLISHED** and all release/live operations remain **HOLD**.
