import { decide } from "../strategies";
import { score, aggregate } from "./scoring";
import type { Offer, Label, Artifact, Preference, Setting } from "../types";
export function evaluation(
  offers: Offer[],
  labels: Label[],
  artifacts: Artifact[],
  preferences: Preference[],
  setting: Setting,
  includeBreakdowns = true,
) {
  const rows = offers.flatMap((o) => {
    const label = labels.find((l) => l.id === o.id)!,
      artifact = artifacts.find((a) => a.id === o.id)!;
    return preferences
      .filter((p) => p.id === o.id)
      .map((p) => score(o, label, artifact, p, setting));
  });
  const names = [...new Set(preferences.map((p) => p.strategy))];
  const totals = Object.fromEntries(
    names.map((name) => [
      name,
      aggregate(rows.filter((r) => r.strategy === name)),
    ]),
  );
  const families = includeBreakdowns
    ? Object.fromEntries(
        [...new Set(offers.map((o) => o.family))].map((family) => [
          family,
          Object.fromEntries(
            names.map((name) => [
              name,
              aggregate(
                rows.filter((r) => r.family === family && r.strategy === name),
              ),
            ]),
          ),
        ]),
      )
    : {};
  const evidence = includeBreakdowns
    ? Object.fromEntries(
        [...new Set(offers.map((o) => o.evidence.quality))].map((quality) => [
          quality,
          Object.fromEntries(
            names.map((name) => [
              name,
              aggregate(
                rows.filter(
                  (r) =>
                    r.strategy === name &&
                    offers.find((o) => o.id === r.id)!.evidence.quality ===
                      quality,
                ),
              ),
            ]),
          ),
        ]),
      )
    : {};
  return { setting, totals, families, evidence, rows };
}
export function preferencesForSetting(offers: Offer[], s: Setting) {
  return offers.flatMap((o) =>
    decide(
      {
        ...o,
        price_units: o.price_units * s.transaction_scale,
        provider_fee_units: o.provider_fee_units * s.transaction_scale,
        value_units: o.value_units * s.transaction_scale * s.value_scale,
        static: {
          ...o.static,
          budget_units: o.static.budget_units * s.transaction_scale,
        },
      },
      s.evidence,
    ),
  );
}
