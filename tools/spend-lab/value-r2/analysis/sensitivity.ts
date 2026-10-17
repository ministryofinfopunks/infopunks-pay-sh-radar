import protocol from "../preregistration.json";
import { evaluation, preferencesForSetting } from "./compare";
import type { Offer, Label, Artifact, Setting, EvidenceMode } from "../types";
export function sensitivity(
  offers: Offer[],
  labels: Label[],
  artifacts: Artifact[],
) {
  const rows = [];
  // Decisions are cached only inside this counterfactual calculation, not a production authorization cache.
  const cache = new Map<string, ReturnType<typeof preferencesForSetting>>();
  for (const evidence of protocol.evidence_grid as EvidenceMode[])
    for (const transaction_scale of protocol.transaction_scale_grid)
      for (const value_scale of protocol.task_value_scale_grid)
        for (const risk of protocol.risk_grid)
          for (const judgment_fee of protocol.fee_grid) {
            const setting: Setting = {
                evidence,
                transaction_scale,
                value_scale,
                risk,
                judgment_fee,
              },
              key = JSON.stringify([evidence, transaction_scale, value_scale]);
            if (!cache.has(key))
              cache.set(key, preferencesForSetting(offers, setting));
            // No family rows needed for each sweep; aggregate the full set, never a winning-case subset.
            const report = evaluation(
                offers,
                labels,
                artifacts,
                cache.get(key)!,
                setting,
                false,
              ),
              t = report.totals;
            const bestCheap = Math.max(
              t.no_radar.net_units,
              t.simple_policy.net_units,
              t.cheap_preflight.net_units,
            );
            rows.push({
              ...setting,
              totals: t,
              full_delta_vs_best_cheap:
                Math.round((t.full_paid_radar.net_units - bestCheap) * 1e8) /
                1e8,
              full_net_positive: t.full_paid_radar.net_units > 0,
              full_beats_references_and_abstention:
                t.full_paid_radar.net_units > Math.max(0, bestCheap),
              full_incremental_positive:
                t.full_paid_radar.delta_vs_no_radar > 0,
              full_beats_all_reference_strategies:
                t.full_paid_radar.net_units > bestCheap,
            });
          }
  return {
    settings: rows.length,
    positive_vs_no_radar: rows.filter((r) => r.full_incremental_positive)
      .length,
    negative_vs_no_radar: rows.filter(
      (r) => r.totals.full_paid_radar.delta_vs_no_radar < 0,
    ).length,
    tied_vs_no_radar: rows.filter(
      (r) => r.totals.full_paid_radar.delta_vs_no_radar === 0,
    ).length,
    beats_references_and_abstention: rows.filter(
      (r) => r.full_beats_references_and_abstention,
    ).length,
    beats_best_reference: rows.filter(
      (r) => r.full_beats_all_reference_strategies,
    ).length,
    rows,
  };
}
