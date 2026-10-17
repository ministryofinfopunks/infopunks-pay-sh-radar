import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
import {
  loadDevelopment,
  loadHoldoutOffers,
  loadHoldoutTruth,
  validateDataset,
  root,
} from "./data";
import { freezeDecisions, assertFrozenDecisions } from "./frozen-evaluation";
import { baseSetting, type Preference } from "./types";
import { evaluation } from "./analysis/compare";
import { sensitivity } from "./analysis/sensitivity";
import { auditProvenance } from "./provenance-audit";
import { validateHttpReplay } from "./http-validation";
const save = (path: string, v: unknown) =>
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n", { mode: 0o600 });
export async function runValueQualification(
  output: string,
  options: { http?: boolean; sweeps?: boolean } = {},
) {
  if (existsSync(output)) throw new Error("fresh_output_required");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const dev = loadDevelopment(),
    holdoutOffers = loadHoldoutOffers();
  if (
    dev.offers.some((o) =>
      holdoutOffers.some(
        (h) =>
          h.id === o.id ||
          h.provider_id === o.provider_id ||
          hashCanonical(h.input) === hashCanonical(o.input),
      ),
    )
  )
    throw new Error("split_overlap");
  // The source commitment exists before policies. Persist offers-only preferences before loading any holdout labels.
  const holdoutFrozen = join(output, "holdout-frozen-decisions.json");
  const holdoutPreferences = await freezeDecisions(
    holdoutOffers,
    holdoutFrozen,
  );
  const devFrozen = join(output, "development-frozen-decisions.json");
  const devPreferences = await freezeDecisions(dev.offers, devFrozen);
  const truth = loadHoldoutTruth();
  const commitment = JSON.parse(
    readFileSync(join(root, "datasets/holdout/commitment.json"), "utf8"),
  );
  if (
    hashCanonical(truth.labels) !== commitment.labels_hash ||
    hashCanonical(truth.artifacts) !== commitment.artifacts_hash ||
    hashCanonical(holdoutOffers) !== commitment.offers_hash
  )
    throw new Error("holdout_commitment_changed");
  validateDataset(dev.offers, dev.labels, dev.artifacts);
  validateDataset(holdoutOffers, truth.labels, truth.artifacts);
  const development = evaluation(
    dev.offers,
    dev.labels,
    dev.artifacts,
    devPreferences,
    baseSetting,
  );
  const holdout = evaluation(
    holdoutOffers,
    truth.labels,
    truth.artifacts,
    holdoutPreferences,
    baseSetting,
  );
  const t = development.totals;
  if (
    t.no_radar.net_units !== 101 ||
    t.full_paid_radar.net_units !== 68 ||
    t.full_paid_radar.false_blocks !== 3 ||
    t.full_paid_radar.correct_abstentions !== 6 ||
    t.full_paid_radar.prevented_losses_units !== 46 ||
    t.full_paid_radar.missed_gains_units !== 62 ||
    t.full_paid_radar.judgment_fees_units !== 17
  )
    throw new Error("pr16_economic_baseline_changed");
  const mismatches = dev.originalRows.filter(
    (r) =>
      devPreferences.find(
        (p) => p.id === r.task_id && p.strategy === "full_paid_radar",
      )!.canonical_decision !== r.radar_decision,
  );
  if (mismatches.length)
    throw new Error("development_canonical_replay_mismatch");
  const safetyCheck = (preferences: Preference[]) =>
    preferences
      .filter((p) => p.strategy === "staged_safe_radar")
      .every(
        (p) =>
          !p.execution_authorized &&
          (!p.prefer_spend ||
            (p.canonical_decision === "proceed" &&
              preferences.some(
                (f) =>
                  f.id === p.id &&
                  f.strategy === "full_paid_radar" &&
                  f.prefer_spend,
              ))),
      );
  if (!safetyCheck(devPreferences) || !safetyCheck(holdoutPreferences))
    throw new Error("reject_only_composition_failed");
  const http =
    options.http === false
      ? null
      : await validateHttpReplay(holdoutOffers, holdoutPreferences, output);
  const sweeps =
    options.sweeps === false
      ? null
      : {
          development: sensitivity(dev.offers, dev.labels, dev.artifacts),
          holdout: sensitivity(holdoutOffers, truth.labels, truth.artifacts),
        };
  if (sweeps) {
    save(join(output, "development-sensitivity.json"), sweeps.development);
    save(join(output, "holdout-sensitivity.json"), sweeps.holdout);
  }
  const summary = {
    version: "first-spender.economic-value-r2.v1",
    status: "HOLD",
    economic_usefulness: "NOT_ESTABLISHED",
    simulation: true,
    real_payments: 0,
    curation: "same_operator_separate_local_track_not_external_truth",
    holdout_commitment: commitment.labels_hash,
    development_cases: dev.offers.length,
    holdout_cases: holdoutOffers.length,
    development: development.totals,
    holdout: holdout.totals,
    sensitivity: sweeps
      ? Object.fromEntries(
          Object.entries(sweeps).map(([key, { rows, ...stats }]) => [
            key,
            stats,
          ]),
        )
      : null,
    safety: {
      source_execution_gates_unchanged: true,
      reject_only_composition: true,
      actual_executions: 0,
      preferences_are_not_capabilities: true,
    },
    http_validation: http
      ? {
          cases: http.cases,
          simulated_payments: http.simulated_payments,
          mismatches: http.mismatches,
          real_payments: 0,
        }
      : null,
    actual_monetary_fees: null,
    infrastructure_cost: null,
    external_outcome_accuracy: null,
    market_population_confidence_interval: null,
    limitations: [
      "Synthetic durations and local utility assumptions",
      "Free cheap probes and check costs are modeled, not provider invoices",
      "No external curator, market valuation or population inference",
      "Holdout source visible to same operator; not adversarial secrecy",
      "Sensitivity sweeps reuse the holdout and do not preserve it for future tuning",
    ],
  };
  save(join(output, "development-comparison.json"), development);
  save(join(output, "holdout-comparison.json"), holdout);
  save(join(output, "provenance-audit.json"), auditProvenance());
  if (http) save(join(output, "http-replay.json"), http);
  save(join(output, "summary.json"), summary);
  assertFrozenDecisions(holdoutFrozen, holdoutPreferences);
  assertFrozenDecisions(devFrozen, devPreferences);
  return summary;
}
