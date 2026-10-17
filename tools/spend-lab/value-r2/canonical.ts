/** Pure replay of the UNCHANGED canonical assessment; never issues an authorization. */
import { assessFrozenDecision } from "../../../src/services/decisionContextService";
import { PreSpendCheckResponseSchema } from "../../../src/schemas/entities";
import { ObservationReceiptSchema } from "../../../src/schemas/receipts";
import {
  hashCanonical,
  sealReceipt,
} from "../../../src/services/receiptIntegrityService";
import {
  localSimulationDomain,
  localSimulationProvenance,
} from "../../../src/security/evidenceProvenance";
import type { Offer, Canonical, EvidenceMode } from "./types";
const domain = localSimulationDomain();
export function transformEvidence(offer: Offer, mode: EvidenceMode): Offer {
  const o = structuredClone(offer),
    bucket = parseInt(hashCanonical(o.id).slice(7, 15), 16) % 100;
  if (
    mode === "all_missing" ||
    (mode === "drop_25_percent" && bucket < 25) ||
    (mode === "drop_50_percent" && bucket < 50)
  ) {
    o.evidence.quality = "missing";
    o.evidence.sufficient = false;
  }
  if (mode === "all_stale") o.evidence.quality = "stale";
  if (mode === "confidence_minus_20")
    o.evidence.confidence = Math.max(0, o.evidence.confidence - 20);
  return o;
}
export function canonicalAssessment(offer: Offer): Canonical {
  const at = new Date("2026-10-08T00:00:02Z");
  const request = {
    agent_id: "agent",
    intent: "buy_market_research lab-" + offer.id,
    budget: 1,
    risk_tolerance: "low" as const,
    required_confidence: 80,
    preferred_settlement: "stablecoin",
    subject_id: "route-value-r2",
  };
  const legacy = PreSpendCheckResponseSchema.parse({
    intent: request.intent,
    decision: "use_with_caution",
    recommended_route: request.subject_id,
    confidence_score: 0,
    risk_level: "low",
    estimated_cost: "0.1 USDC",
    last_successful_run: null,
    known_blockers: [],
    requires_human_approval: false,
    receipt_references: [],
    safer_alternatives: [],
    do_not_use: [],
    rationale: ["Offline source replay only."],
  });
  const payload = {
    catalog_live: false,
    identity_resolved: true,
    required_proof_complete: true,
    intent_satisfied: true,
    constraints_satisfied: true,
    confidence: offer.evidence.confidence,
    deterministic_veto: offer.evidence.veto,
    bounded_test_allowed: false,
    max_cost: 0.1,
    asset: "USDC",
    settlement: "stablecoin",
    route_id: request.subject_id,
    decision_state: "approved",
    reasons: ["Synthetic committed evidence; no external authority."],
  };
  const observations =
    offer.evidence.quality === "missing"
      ? []
      : [
          ObservationReceiptSchema.parse(
            sealReceipt("observation", {
              schema_version: "canonical-receipts.v1",
              observation_id: "value-" + offer.id,
              subject_type: "route",
              subject_id: request.subject_id,
              intent_hash: hashCanonical(request),
              source_type: "reviewed_judgment_facts",
              source_id: "spend-lab/value-r2",
              observed_at: "2026-10-08T00:00:00Z",
              ingested_at: "2026-10-08T00:00:01Z",
              freshness_expires_at:
                offer.evidence.quality === "stale"
                  ? "2026-10-08T00:00:02Z"
                  : "2026-10-08T00:02:00Z",
              evidence_state: offer.evidence.sufficient
                ? "sufficient"
                : "insufficient",
              evidence_refs: ["lab-probe/" + offer.id],
              provenance: offer.evidence.authority_explicit
                ? { ...localSimulationProvenance }
                : { catalog_source: "simulation" },
              payload,
              payload_hash: hashCanonical(payload),
            }),
          ),
        ];
  return assessFrozenDecision(
    request,
    legacy,
    observations,
    null,
    at,
    {
      engine_version: "pre-spend-decision.v2",
      threshold: 80,
      veto_threshold: -10,
      ttl_ms: 60000,
      amount: "0.01",
      asset: "USDC",
    },
    domain,
  ).decision;
}
