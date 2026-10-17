import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
import { tasks } from "../successor/profiles";
import { reference } from "../successor/oracle";
import { declaredDevelopmentProbe } from "./curation/development-probes";
import { holdoutReference } from "./curation/reference";
import {
  OfferSchema,
  LabelSchema,
  ArtifactSchema,
  type Offer,
  type Artifact,
  type Label,
} from "./types";
export const root = resolve(__dirname);
const read = (path: string) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
export function loadHoldoutOffers(): Offer[] {
  return z.array(OfferSchema).parse(read("datasets/holdout/offers.json"));
}
export function loadHoldoutTruth() {
  return {
    labels: z.array(LabelSchema).parse(read("datasets/holdout/labels.json")),
    artifacts: z
      .array(ArtifactSchema)
      .parse(read("datasets/holdout/artifacts.json")),
  };
}
export function loadDevelopment() {
  const rows = read("datasets/development/baseline-case-rows.json") as Array<
    Record<string, any>
  >;
  const offers: Offer[] = tasks.map((t) => {
    return OfferSchema.parse({
      id: t.id,
      family: t.family,
      contract: "Frozen PR16 task oracle",
      input: t.input,
      provider_id: "development/" + t.implementation,
      price_units: t.price_units,
      provider_fee_units: t.fee_units,
      value_units: t.value_units,
      loss_exposure_units: 0,
      deadline_ms: t.deadline_ms,
      static: {
        identity_verified: true,
        recipient_allowlisted: true,
        quote_valid: true,
        rail_supported: true,
        budget_units: 50,
      },
      evidence: {
        quality: t.probe.sufficient ? "fresh" : "missing",
        confidence: t.probe.confidence,
        veto: t.probe.veto,
        sufficient: t.probe.sufficient,
        authority_explicit: true,
      },
      cheap_probe: declaredDevelopmentProbe(t.implementation),
    });
  });
  const artifacts: Artifact[] = offers.map((o) => {
    const d = rows.find((r) => r.task_id === o.id)!.baseline_delivery;
    return ArtifactSchema.parse({
      id: o.id,
      output: d.output,
      status: d.status,
      elapsed_ms: d.elapsed_ms,
      charged_units: d.charged_units,
      provider_fee_units: d.fee_units,
      simulation: true,
    });
  });
  const labels: Label[] = offers.map((o, i) => {
    const row = rows.find((r) => r.task_id === o.id)!;
    const expected = reference(o.family, o.input);
    const correct =
      artifacts[i].status === "ok" &&
      hashCanonical(artifacts[i].output) === hashCanonical(expected);
    const success = correct && artifacts[i].elapsed_ms <= o.deadline_ms;
    const net =
      (success ? o.value_units : 0) - o.price_units - o.provider_fee_units;
    if (net !== Number(row.baseline_net_units))
      throw new Error("development_outcome_changed");
    return {
      id: o.id,
      expected_output: expected as Label["expected_output"],
      output_correct: correct,
      within_deadline: artifacts[i].elapsed_ms <= o.deadline_ms,
      success,
      net_units: net,
      should_spend: row.label_should_spend,
      artifact_hash: hashCanonical(artifacts[i]),
      offer_hash: hashCanonical(o),
    };
  });
  return { offers, artifacts, labels, originalRows: rows };
}
export function validateDataset(
  offers: Offer[],
  labels: Label[],
  artifacts: Artifact[],
) {
  const ids = offers.map((o) => o.id);
  if (
    new Set(ids).size !== ids.length ||
    labels.length !== ids.length ||
    artifacts.length !== ids.length ||
    new Set(labels.map((l) => l.id)).size !== ids.length ||
    new Set(artifacts.map((a) => a.id)).size !== ids.length
  )
    throw new Error("dataset_coverage_invalid");
  for (const o of offers) {
    const l = labels.find((l) => l.id === o.id),
      a = artifacts.find((a) => a.id === o.id);
    if (
      !l ||
      !a ||
      l.offer_hash !== hashCanonical(o) ||
      l.artifact_hash !== hashCanonical(a)
    )
      throw new Error("dataset_binding_invalid");
    const correct =
      a.status === "ok" &&
      hashCanonical(a.output) === hashCanonical(l.expected_output);
    const within = a.elapsed_ms <= o.deadline_ms;
    if (
      correct !== l.output_correct ||
      within !== l.within_deadline ||
      l.success !== (correct && within)
    )
      throw new Error("label_correctness_invalid");
    if (
      o.provider_id.startsWith("holdout/") &&
      hashCanonical(holdoutReference(o.family, o.input)) !==
        hashCanonical(l.expected_output)
    )
      throw new Error("reference_contract_mismatch");
    const net =
      (l.success ? o.value_units : -o.loss_exposure_units) -
      a.charged_units -
      a.provider_fee_units;
    if (net !== l.net_units || l.should_spend !== net > 0)
      throw new Error("label_economic_identity_invalid");
  }
}
