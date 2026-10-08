# Decisions qualification corpus v1

This corpus is a **synthetic policy qualification set**, not a sample of production judgments and not human-adjudicated semantic ground truth. Its 19 labels were written from the deterministic `JudgmentService` policy before any Decisions provider output was observed. The fixture declares `reviewer_status: pending_external_review`; it must not be reported as independently reviewed accuracy.

## Reproduce the labels

From this repository checkout:

```sh
npm ci
npm run verify:decisions-corpus
```

The verifier parses the strict fixture shape, requires all six categories and real source paths, rejects provider-output fields, and replays every case through `createJudgmentService` using the fixed `2026-10-07T00:00:02Z` clock. It checks the decision, payment requirement, quote/free response, production shadow eligibility, absence of a judgment receipt before settlement, and absence of facilitator verify/settle calls. No API key, network service, signing key, or payment rail is used.

## Label rules and provenance

Each case identifies source files and rule IDs. The baseline is the current deterministic policy, not an OpenAI answer. The replay harness uses a sealed observation receipt created by the test authority, then applies only the case's declared policy, observation, or legacy overrides. This catches divergence if the judgment policy changes after labels are frozen.

| Rule | Policy evidence |
| --- | --- |
| `fresh_scoped_reviewed_evidence`, `evidence_refs_required`, `live_provenance_required`, `reviewed_source_required`, `subject_binding`, `freshness_required`, `sufficient_state_required` | `src/services/judgmentService.ts` evidence gate |
| `reviewed_fact_schema` | `src/schemas/preSpend.ts` strict reviewed facts schema |
| `route_binding`, `settlement_binding`, `budget_binding` | `src/services/judgmentService.ts` route, settlement, and budget checks |
| `approved_threshold`, `bounded_caution`, `veto_dominates`, `reviewed_state_over_legacy`, `human_approval_blocks_proceed` | `src/services/judgmentService.ts` canonical decision mapping and final vetoes |
| `reason_text_is_data` | `src/services/judgmentService.ts` decision construction and `src/services/decisionsJudgmentShadow.ts` read-only comparison |
| `free_insufficient` | `src/services/judgmentService.ts` zero cost and no journal quote for insufficient evidence |

`production_shadow_eligible` is separately verified against the actual shadow callback. Some evidence-complete cases are still labeled `insufficient_evidence` because confidence or human authorization blocks a spend decision. Cases with missing, stale, mismatched, or unreviewed evidence are useful as **offline adversarial challenges**, but the production shadow path does not send them to the provider. This distinction must remain visible in benchmark reports.

## Required external review before activation

An independent reviewer should inspect the case facts and rule sources without viewing model outputs, record an approval or corrections with identity and date, and sign the frozen fixture SHA-256. A second evaluation set should be drawn from consented, de-identified staging or production-like outcomes with verified O→J→X→E ancestry and labeled separately. Until then, any accuracy value is **policy replay accuracy on synthetic cases** only. Provider latency, reliability, and cost require a dedicated live run; this corpus run does not measure them.
