/** Reviewer diagnostic only. Never installed into application issuance or storage. */
import {
  eligibleEvidenceProvenance,
  localSimulationProvenance,
} from "../../../src/security/evidenceProvenance";
export function explicitReviewedProvenance(p: Record<string, unknown>) {
  return (
    p.catalog_source === "live" &&
    p.fixture === false &&
    p.simulation === false &&
    p.evidence_class === "live_evidence" &&
    p.spending_authority === "reviewed_live" &&
    p.external_economic_activity === true &&
    p.environment === "production"
  );
}
export function auditProvenance() {
  const complete = {
    catalog_source: "live",
    fixture: false,
    simulation: false,
    evidence_class: "live_evidence",
    spending_authority: "reviewed_live",
    external_economic_activity: true,
    environment: "production",
  };
  const vectors: Array<{ id: string; provenance: Record<string, unknown> }> = [
    { id: "legacy-only-catalog-live", provenance: { catalog_source: "live" } },
    { id: "complete-declaration-not-independent-proof", provenance: complete },
    { id: "simulation", provenance: { ...localSimulationProvenance } },
  ];
  const fields = [
    "fixture",
    "simulation",
    "evidence_class",
    "spending_authority",
    "external_economic_activity",
    "environment",
  ];
  for (const field of fields) {
    const absent = { ...complete } as Record<string, unknown>;
    delete absent[field];
    vectors.push({ id: field + "-absent", provenance: absent });
    for (const value of [null, "true", "false", "", 0, 1, false, true])
      vectors.push({
        id: field + "-" + JSON.stringify(value),
        provenance: { ...complete, [field]: value },
      });
  }
  const results = vectors.map((v) => ({
    ...v,
    current_eligibility: eligibleEvidenceProvenance(v.provenance),
    explicit_diagnostic: explicitReviewedProvenance(v.provenance),
  }));
  return {
    status: "HOLD",
    production_population_scanned: false,
    production_record_count: null,
    application_policy_changed: false,
    finding:
      "Legacy absent authority declarations can satisfy the current live predicate; declarations alone do not establish verified external authority.",
    severity: "RELEASE_REVIEW_BLOCKER",
    vectors: results,
    permissive_relative_to_explicit_diagnostic: results
      .filter((r) => r.current_eligibility && !r.explicit_diagnostic)
      .map((r) => r.id),
  };
}
