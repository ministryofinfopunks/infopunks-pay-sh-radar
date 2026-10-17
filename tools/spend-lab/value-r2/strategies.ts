/** No dataset/outcome/oracle imports. Counterfactual preferences cannot execute. */
import {
  OfferSchema,
  type Offer,
  type Preference,
  type EvidenceMode,
} from "./types";
import { canonicalAssessment, transformEvidence } from "./canonical";
export function commonAdmissible(o: Offer) {
  return (
    o.static.recipient_allowlisted &&
    o.static.rail_supported &&
    o.price_units + o.provider_fee_units <= o.static.budget_units
  );
}
export function simplePass(o: Offer) {
  return (
    commonAdmissible(o) &&
    o.static.identity_verified &&
    o.static.quote_valid &&
    o.value_units > o.price_units + o.provider_fee_units
  );
}
export function cheapPass(o: Offer) {
  return (
    simplePass(o) &&
    o.cheap_probe.reachable &&
    o.cheap_probe.schema_valid &&
    o.cheap_probe.within_latency_bound
  );
}
export function decide(
  raw: unknown,
  mode: EvidenceMode = "as_recorded",
): Preference[] {
  const o = transformEvidence(OfferSchema.parse(raw), mode),
    canonical = canonicalAssessment(o);
  const common = commonAdmissible(o),
    simple = simplePass(o),
    cheap = cheapPass(o);
  const item = (
    strategy: Preference["strategy"],
    prefer_spend: boolean,
    decision: Preference["canonical_decision"],
    paid_judgment: boolean,
    simple_checks: number,
    cheap_probes: number,
    reason: string,
  ): Preference => ({
    id: o.id,
    strategy,
    prefer_spend,
    canonical_decision: decision,
    paid_judgment,
    simple_checks,
    cheap_probes,
    reason,
    execution_authorized: false,
  });
  return [
    item(
      "no_radar",
      common,
      null,
      false,
      0,
      0,
      "Counterfactual budget/scope preference; no authority",
    ),
    item(
      "simple_policy",
      simple,
      null,
      false,
      1,
      0,
      "Static identity/quote/margin filter; no authority",
    ),
    item(
      "cheap_preflight",
      cheap,
      null,
      false,
      1,
      simple ? 1 : 0,
      "Static checks plus synthetic free-probe metadata; no authority",
    ),
    item(
      "full_paid_radar",
      common && canonical === "proceed",
      canonical,
      canonical !== "insufficient_evidence",
      0,
      0,
      "Unchanged canonical replay; fees on qualified paid verdicts including blocks",
    ),
    item(
      "staged_safe_radar",
      cheap && canonical === "proceed",
      cheap ? canonical : null,
      cheap && canonical !== "insufficient_evidence",
      1,
      simple ? 1 : 0,
      "Reject-only cheap screening before unchanged canonical gate; still no capability",
    ),
  ];
}
