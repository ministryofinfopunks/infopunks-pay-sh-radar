# Decisions independent-label review protocol v1

Status: **protocol prepared; no independent labels or verified historical outcomes have been supplied.** This document governs the next immutable dataset version. It does not promote the existing 19 synthetic cases into real-world evidence.

## Evidence classes

| Class | Meaning | May support live quality claim? |
| --- | --- | --- |
| `synthetic_policy_replay` | Authored fixture with label derived from current deterministic rules. | No. Useful only for regression and adversarial rehearsal. |
| `historical_unverified` | Canonical row obtained from an identified read-only snapshot, but authenticity, execution proof, or outcome truth has not been independently checked. | No. |
| `historical_pending` | Observation/Judgment/Execution exists, but no Evaluation or final outcome is available. | No outcome claim; may be retained for later follow-up. |
| `historical_verified_complete` | Receipt integrity, O→J→X→E ancestry, issuer signature, time ordering, external execution proof, and independent outcome artifacts have each passed separate checks. | Eligible for outcome analysis after blinded label review and consent/de-identification checks. |
| `independently_reviewed_pre_spend` | Two independent reviewers assessed the pre-spend facts without policy/model answers or later outcome evidence; disagreements were adjudicated. | Eligible for judgment-quality comparison once the case's source class is disclosed. |

The 19-case [blinded packet](decisions-blinded-review-packet-v1.json) is **synthetic**. The coordinator-only mapping in `tests/fixtures/decisions-review-coordinator-map-v1.json` contains the policy replay labels and must not be shown to reviewers before their assessments are locked. The packet omits source case IDs, categories, expected labels, rule IDs, and model outputs. Each reviewer receives only the packet; access to this repository or coordinator map would defeat the blind. The packet's `observation.provenance.catalog_source` is part of the synthetic stimulus, not evidence that a live observation occurred.

## Review procedure

1. Freeze the input packet as bytes and record its SHA-256, Git commit, case count, source class, extraction snapshot, and de-identification approval. Never edit that version in place; corrections create a new version with a parent hash and reason.
2. Two reviewers who did not author the fixture, implement the policy, or inspect model outputs independently assess each case. They receive the pre-spend request and observations available **at the judgment time**. Withhold the recorded Judgment decision, Execution, Evaluation, outcome artifacts, future observations, and provider suggestions.
3. Each reviewer records an opaque reviewer ID, assessment time, one of `proceed`, `test_spend_first`, `do_not_spend`, `insufficient_evidence`, confidence in their own assessment, rationale, evidence references or receipt hashes actually inspected, and an explicit `evidence_sufficient` finding. Empty or unverifiable references are not acceptable. Reviewer identity and independence are checked against a separately controlled roster.
4. If reviewers disagree, a third independent adjudicator records both positions, the disputed facts, additional evidence references, the resolution and reason. A model answer or the old policy label must not be used to break a tie. If they agree, the coordinator records that consensus without changing either signed assessment.
5. Only after assessments are locked, reveal the historical Judgment/policy decision for baseline comparison. The outcome reviewer works separately: verify the external execution transaction or delivery artifact at the relevant chain/rail, binding and finality; inspect the Evaluation evidence artifacts, provenance, issuer authority and timestamps. A receipt field claiming `verified: true`, a nonempty `evidence_refs` array, or internal evaluator identity alone is not independent outcome proof.
6. Freeze a resolved dataset under `decisions-reviewed-benchmark.v1` with content SHA-256, original snapshot hash, reviewer record hashes, adjudication hash, execution/outcome verifier record hashes, code commit, and a versioned exclusion ledger. A changed label, source receipt, redaction or outcome creates a new dataset version. Retain prior versions and explain each change.

`src/schemas/decisionsIndependentReview.ts` enforces two distinct blinded assessments, nonempty evidence references with content hashes, temporal ordering and independent adjudication when reviewers disagree. `scripts/freeze-decisions-independent-review.ts` checks that every review record matches exactly one frozen packet case and writes a content-addressed file with exclusive creation. Its status remains `structure_validated_external_identity_pending`: the file does **not** attest that the reviewer roster, signatures, cited artifacts or independence have been externally checked. Only an external reviewer authority can complete that step, and a synthetic source class stays synthetic after review.

## Case record contract

Every candidate needs: opaque case ID; source class and source snapshot hash; pre-spend request artifact hash; cited Observation IDs and receipt hashes; Judgment ID/hash/time; a model-visible context assembled solely from the request and observations available before issuance; two blinded assessment records; resolution record; and an explicit inclusion/exclusion reason. For verified outcomes also require Execution and Evaluation IDs/hashes, parent-pointer replay result, issuer public-key trust version, independent settlement/delivery verifier artifact references, independent outcome evidence artifact references and verifier identities. Store private artifacts in the approved evidence store; the benchmark corpus may contain hashes and de-identified facts only.

The benchmark model input must contain **only** the frozen pre-spend request and eligible observations. The outcome, evaluation receipt, recorded judgment, reviewer decisions and provider answers are kept in separate scoring metadata. The input hash is checked immediately before dispatch. A dataset without resolved independent labels, external evidence, or a verified historical source remains blocked and cannot be relabeled as production truth.

## Metrics and gate

Report denominators and confidence intervals by source class. Compare the recorded deterministic Judgment to independently resolved labels; count `proceed` against any non-`proceed` reviewed label as a false ALLOW. Separately compare pre-spend decisions to later **verified** outcomes, noting that a later bad outcome does not itself prove a policy violation. Track missing outcomes, exclusions, abstentions, and disagreements. Report provider calibration, unsafe approval suggestions, latency and cost only after a dedicated live run on the **same frozen inputs**. The model's suggestion never changes a historical receipt, reputation, spend authorization, or payment.

Release gates require independent reviewer sign-off, a nonempty eligible historical cohort, false-ALLOW threshold declared before seeing model answers, verified causal-loop evidence, credential and staging authorization, and separate commercial review. Until those gates pass, the Decisions feature remains disabled.
