import { z } from "zod";
export const OfferSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    family: z.string(),
    contract: z.string(),
    input: z.json(),
    provider_id: z.string(),
    price_units: z.number().finite().nonnegative(),
    provider_fee_units: z.number().finite().nonnegative(),
    value_units: z.number().finite().nonnegative(),
    loss_exposure_units: z.number().finite().nonnegative(),
    deadline_ms: z.number().positive(),
    static: z
      .object({
        identity_verified: z.boolean(),
        recipient_allowlisted: z.boolean(),
        quote_valid: z.boolean(),
        rail_supported: z.boolean(),
        budget_units: z.number().positive(),
      })
      .strict(),
    evidence: z
      .object({
        quality: z.enum(["fresh", "missing", "stale", "legacy-absent"]),
        confidence: z.number().min(0).max(100),
        veto: z.boolean(),
        sufficient: z.boolean(),
        authority_explicit: z.boolean(),
      })
      .strict(),
    cheap_probe: z
      .object({
        reachable: z.boolean(),
        schema_valid: z.boolean(),
        within_latency_bound: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type Offer = z.infer<typeof OfferSchema>;
export const LabelSchema = z
  .object({
    id: z.string(),
    expected_output: z.json(),
    output_correct: z.boolean(),
    within_deadline: z.boolean(),
    success: z.boolean(),
    net_units: z.number(),
    should_spend: z.boolean(),
    artifact_hash: z.string(),
    offer_hash: z.string(),
  })
  .strict();
export type Label = z.infer<typeof LabelSchema>;
export const ArtifactSchema = z
  .object({
    id: z.string(),
    output: z.json(),
    status: z.enum(["ok", "error"]),
    elapsed_ms: z.number().nonnegative(),
    charged_units: z.number().nonnegative(),
    provider_fee_units: z.number().nonnegative(),
    simulation: z.literal(true),
  })
  .strict();
export type Artifact = z.infer<typeof ArtifactSchema>;
export const strategies = [
  "no_radar",
  "simple_policy",
  "cheap_preflight",
  "full_paid_radar",
] as const;
export type Strategy = (typeof strategies)[number];
export type Canonical =
  "proceed" | "test_spend_first" | "do_not_spend" | "insufficient_evidence";
export type Preference = {
  id: string;
  strategy: Strategy | "staged_safe_radar";
  prefer_spend: boolean;
  canonical_decision: Canonical | null;
  paid_judgment: boolean;
  simple_checks: number;
  cheap_probes: number;
  reason: string;
  execution_authorized: false;
};
export type EvidenceMode =
  | "as_recorded"
  | "drop_25_percent"
  | "drop_50_percent"
  | "all_missing"
  | "all_stale"
  | "confidence_minus_20";
export type Setting = {
  judgment_fee: number;
  risk: number;
  transaction_scale: number;
  value_scale: number;
  evidence: EvidenceMode;
};
export const baseSetting: Setting = {
  judgment_fee: 1,
  risk: 1,
  transaction_scale: 1,
  value_scale: 1,
  evidence: "as_recorded",
};
