import type { Offer, Label, Artifact, Preference, Setting } from "../types";
const rounded = (n: number) => Math.round(n * 1e8) / 1e8;
/** Only the post-decision scorer can see outcomes/labels. */
export function score(
  o: Offer,
  l: Label,
  a: Artifact,
  p: Preference,
  s: Setting,
) {
  const serviceCost =
    (a.charged_units + a.provider_fee_units) * s.transaction_scale;
  const deliveredValue = l.success
    ? o.value_units * s.value_scale * s.transaction_scale
    : 0;
  const loss = l.success
    ? 0
    : o.loss_exposure_units * s.risk * s.transaction_scale;
  const potential = deliveredValue - loss - serviceCost;
  const overhead = p.simple_checks * 0.05 + p.cheap_probes * 0.2;
  const judgmentFee = p.paid_judgment ? s.judgment_fee : 0;
  const actual = p.prefer_spend ? potential : 0;
  const referenceSpend =
    o.static.recipient_allowlisted &&
    o.static.rail_supported &&
    o.price_units + o.provider_fee_units <= o.static.budget_units;
  const missed =
    referenceSpend && !p.prefer_spend && potential > 0 ? potential : 0;
  const prevented =
    referenceSpend && !p.prefer_spend && potential < 0 ? -potential : 0;
  const baseline = referenceSpend ? potential : 0;
  return {
    id: o.id,
    family: o.family,
    strategy: p.strategy,
    prefer_spend: p.prefer_spend,
    canonical_decision: p.canonical_decision,
    paid_judgment: p.paid_judgment,
    execution_authorized: false,
    ground_truth_success: l.success,
    eligible_reference: referenceSpend,
    potential_net_units: rounded(potential),
    net_units: rounded(actual - judgmentFee - overhead),
    provider_cost_units: p.prefer_spend
      ? a.charged_units * s.transaction_scale
      : 0,
    provider_fee_units: p.prefer_spend
      ? a.provider_fee_units * s.transaction_scale
      : 0,
    loss_units: p.prefer_spend ? loss : 0,
    judgment_fee_units: judgmentFee,
    modeled_check_cost_units: rounded(overhead),
    prevented_losses_units: rounded(prevented),
    missed_gains_units: rounded(missed),
    false_block: referenceSpend && !p.prefer_spend && potential > 0,
    correct_abstention: referenceSpend && !p.prefer_spend && potential <= 0,
    delta_vs_no_radar: rounded(actual - judgmentFee - overhead - baseline),
    perfect_information_regret_units: rounded(
      (referenceSpend ? Math.max(0, potential) : 0) -
        (actual - judgmentFee - overhead),
    ),
  };
}
export type Scored = ReturnType<typeof score>;
export function aggregate(rows: Scored[]) {
  const sum = (field: keyof Scored) =>
    rounded(rows.reduce((n, r) => n + Number(r[field]), 0));
  return {
    cases: rows.length,
    spends: sum("prefer_spend"),
    net_units: sum("net_units"),
    delta_vs_no_radar: sum("delta_vs_no_radar"),
    provider_cost_units: sum("provider_cost_units"),
    provider_fee_units: sum("provider_fee_units"),
    loss_units: sum("loss_units"),
    prevented_losses_units: sum("prevented_losses_units"),
    missed_gains_units: sum("missed_gains_units"),
    judgment_fees_units: sum("judgment_fee_units"),
    modeled_check_cost_units: sum("modeled_check_cost_units"),
    paid_judgments: sum("paid_judgment"),
    false_blocks: sum("false_block"),
    correct_abstentions: sum("correct_abstention"),
    perfect_information_regret_units: sum("perfect_information_regret_units"),
  };
}
