import type {
  EconomicJob,
  EconomicPolicy,
} from "../../../src/schemas/economicEngine";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
export const buyerRoles = [
  "research-buyer",
  "tool-buyer",
  "risk-scout",
  "reliability-tester",
] as const;
export type BuyerRole = (typeof buyerRoles)[number];
export const evaluatorRole = "outcome-evaluator" as const;
export const PROFILE = "spend-lab/mock-service-v1";
export function taskManifest(id: string, role: BuyerRole): EconomicJob {
  const asset = "lab:simulation/MOCK";
  const policy: EconomicPolicy = {
    version: "spend-lab-policy-v1",
    principal_id: role,
    delegate_id: "lab-controller",
    audience: "lab-executor",
    enabled: true,
    manual_review_required: false,
    allowed_handlers: ["local-service"],
    allowed_profiles: [PROFILE],
    allowed_chains: ["lab:simulation"],
    allowed_assets: [asset],
    allowed_payers: ["lab-payer"],
    allowed_recipients: ["lab-provider"],
    allowed_routers: ["lab-router"],
    asset_decimals: { [asset]: 6 },
    revoked_candidate_ids: [],
    max_amount_atomic: "10000",
    max_fee_atomic: "1000",
    budget_atomic: "1100000",
    bounded_test_amount_atomic: "1000",
    velocity_window_ms: 60000,
    max_calls_per_window: 100,
    evidence_threshold: 80,
    choice_confidence_threshold: 0.8,
    choice_probability_threshold: 0.9,
    ttl_ms: 60000,
    max_slippage_bps: 0,
  };
  const task =
    role === "research-buyer"
      ? "Obtain a sourced local research result"
      : role === "tool-buyer"
        ? "Parse the disposable document"
        : role === "risk-scout"
          ? "Assess an uncertain service"
          : "Exercise provider recovery";
  return {
    request_id: id,
    principal_id: role,
    subject_type: "provider",
    subject_id: "lab-provider",
    role: "select",
    intent_hash: hashCanonical({ id, task }),
    state: {
      task,
      simulation: true,
      initial_preference: "cheap-unqualified",
      alternatives: ["cheap-unqualified", "qualified-local"],
    },
    model_id: "jev-1.13.0",
    candidates: [
      {
        id: "qualified-local",
        action: "execute_route",
        handler_id: "local-service",
        description: task,
        evidence_ids: ["obs-" + id],
        operation: {
          profile_id: PROFILE,
          chain_id: "lab:simulation",
          asset_id: asset,
          asset_contract: "MOCK",
          fee_asset_id: asset,
          decimals: 6,
          payer: "lab-payer",
          recipient: "lab-provider",
          router: "lab-router",
          method: "local-service",
          arguments_hash: hashCanonical({ id, task }),
          amount_atomic: "10000",
          max_fee_atomic: "1000",
          max_slippage_bps: 0,
        },
      },
    ],
    evidence_ids: ["obs-" + id],
    question: {
      type: "choice",
      instructions: "Select a qualified local service or abstain.",
    },
    policy,
  };
}
/** A model receives only this intent interface. Execution and signing remain controller-private. */
export function intentTool(
  submit: (manifest: EconomicJob) => Promise<unknown>,
  role: BuyerRole,
) {
  return {
    name: "request_radar_judgment",
    description:
      "Submit a local economic intent; never grants payment authority.",
    invoke: (requestId: string) => submit(taskManifest(requestId, role)),
  };
}
