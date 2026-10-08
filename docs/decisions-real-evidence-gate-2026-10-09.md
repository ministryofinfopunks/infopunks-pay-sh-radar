# Decisions real-evidence qualification gate — 2026-10-09

## Decision

**NO-GO for activation, live spend influence, billing, settlement or production deployment.** The isolated qualification branch starts at candidate `3a93867e0d8d36be4977166bcd6fba40ac9e2325`. The candidate and main checkout were not modified. This phase prepared review and read-only audit machinery; it did not create real-world evidence that was unavailable.

## What evidence exists

| Evidence | Status | Claim permitted |
| --- | --- | --- |
| 19-case corpus | All 19 labels are deterministic-policy-derived synthetic fixtures. Zero independently reviewed labels. | Regression and adversarial rehearsal only. |
| Blinded review packet | 19 opaque synthetic stimuli; coordinator mapping holds old labels separately. No reviewer responses. | Ready for independent assessment, not an accuracy result. |
| Canonical historical receipt inventory | [Access report](decisions-history-inventory-2026-10-09.json) records `data_access_status: unavailable`. No `DECISIONS_HISTORY_READONLY_DATABASE_URL` exists here; local search found no canonical receipt export. Receipt and outcome counts are **unknown**, not zero. | No historical completeness or causal-loop claim. |
| Baseline policy measurement | [Machine-readable report](decisions-real-evidence-baseline-2026-10-09.json) records the synthetic policy replay denominator of 19 and null independently reviewed/verified-outcome metrics. | No real false-ALLOW estimate. |
| Live Decisions benchmark | Dedicated OpenAI key and isolated staging are still unavailable. No live request or invoice measurement. | No live accuracy, latency, reliability or economics claim. |

The corpus categories remain 3 valid approvals, 5 insufficient evidence, 3 provider mismatches, 2 stale observations, 2 manipulated inputs and 4 denied actions. These category names describe fixture construction, not independent truth. The review packet deliberately omits category, source case ID, old decision and model answers. Because reviewers have not returned assessments, the independently reviewable corpus is **pending**, not independently labeled.

## Receipt and outcome audit

`scripts/audit-decisions-history.ts` is an optional direct PostgreSQL reader. With a dedicated read-only URL it opens a repeatable-read, read-only transaction; rejects a role with INSERT, UPDATE, DELETE or TRUNCATE rights on the four canonical receipt tables; caps rows; and returns only hashes, counts and classification reasons. It does not export raw receipt payloads or use application signing credentials. Without the URL it records unavailable access and leaves counts null. The current inventory is this unavailable-access result.

`src/services/decisionsEvidenceAudit.ts` verifies receipt schemas and hashes, O→J→X→E authority, parent pointers, scope and historical time order. Signed Judgment verification requires a supplied public-key trust bundle. It separates synthetic observations, broken chains, unverified issuer authority, pending Evaluations, unverified executions, unverified outcomes and complete verified loops. The last class requires **both** an independent external execution verifier and an independent outcome verifier with evidence references; neither is configured in this run. A receipt's `verification.verified` field and an Evaluation's nonempty `evidence_refs` cannot establish external truth by themselves. These classifiers were exercised on synthetic unit fixtures only; no genuine execution was audited in this environment.

Reproduction uses new output paths because each command refuses to overwrite an earlier artifact:

```sh
npm run review:decisions-packet -- --corpus tests/fixtures/decisions-qualification-cases.json --packet /tmp/decisions-review-packet.json --coordinator-map /tmp/decisions-coordinator-map.json
npm run audit:decisions-history -- --output /tmp/decisions-history-inventory.json
npm run report:decisions-real-evidence -- --corpus tests/fixtures/decisions-qualification-cases.json --inventory docs/decisions-history-inventory-2026-10-09.json --packet docs/decisions-blinded-review-packet-v1.json --output /tmp/decisions-real-evidence-baseline.json
```

With approved historical access, set `DECISIONS_HISTORY_READONLY_DATABASE_URL` in a secret store and rerun the audit with a new output path. Supply `--issuer-trust` as a JSON file containing only the trusted issuer ID and public key records. The read-only transaction and role check fail before any source data is reported if the role has write privileges on canonical receipt tables. No direct external execution or outcome verifier is wired to this CLI; those results remain unverified until independently implemented and reviewed.

The pre-existing Evaluation authority gap remains: internally authenticated outcome submission can refer to arbitrary evidence strings, while score projection accepts authority-valid Evaluation receipts. This qualification branch does not change reputation projection or frozen IPX economics. Before activation, outcome attestation and score eligibility must be addressed in the separate receipt-authority lineage and tested against real evidence.

## Reproducible dataset and benchmark path

The [review protocol](decisions-independent-label-review-v1.md) defines blinded dual assessment, cited evidence, independent disagreement resolution, separate outcome verification, and content-addressed immutable dataset versions. The [blinded synthetic packet](decisions-blinded-review-packet-v1.json) and coordinator map can be regenerated from the frozen 19-case corpus. No `decisions-reviewed-benchmark.v1` dataset is materialized: there are no qualifying historical observations with independently resolved labels and verified outcomes available here. Substituting the existing fixture or the test-double benchmark would misstate the evidence.

The [blocked dataset manifest](decisions-reviewed-benchmark-blocked-v1.json) fixes this state as `materialized_case_count: 0`, `live_runner_eligible: false`, with historical counts null. It is a gate artifact, **not** an input accepted by the live runner.

The review-record schema and freeze command validate two different blind reviewers, required evidence hashes, consensus or separate adjudication, case membership, and a content-addressed output filename. The output explicitly remains pending external identity and artifact verification. There is no reviewer record in this branch.

The existing guarded live runner now accepts `decisions-reviewed-benchmark.v1` separately from the synthetic corpus. A reviewed case carries a frozen `model_context` SHA-256, resolved label, historical policy decision, verified outcome and provenance hashes. The runner serializes **only** `model_context` to `POST /v1/decisions`; it scores against the withheld metadata. Its live CLI also requires an exact approved dataset-file SHA-256 in `DECISIONS_BENCH_REVIEWED_DATASET_SHA256`, in addition to the dedicated credential, environment and spend caps already required. The runner does not call the provider for an empty or absent reviewed dataset. Human sign-off and source verification are still necessary because a hash confirms bytes, not truth.

## Release dimensions

| Dimension | State | Remaining gate |
| --- | --- | --- |
| Implementation readiness | **Locally qualified** | Preserve disabled flag; repeat regression after any integration change. |
| Judgment quality | **Unmeasured on independent labels** | Two blind reviewers, adjudication, nonempty frozen dataset, declared false-ALLOW threshold. |
| Verified causal loop | **Unmeasured on historical receipts** | Read-only canonical snapshot, trusted issuer keys, independent execution and outcome evidence, temporal replay. |
| Commercial readiness | **Unmeasured** | Dedicated Decisions project/key and staging, live quality/latency/reliability, invoice reconciliation and explicit financial approval. |

## Exact blockers and next authorized work

1. Provide a dedicated **read-only** canonical PostgreSQL role/URL through a secret store, plus the historical issuer public-key bundle. A database with no receipt rows is a valid measured zero; absent access is unknown.
2. Provide consented, de-identified pre-spend request artifacts bound to Observation `intent_hash`, and independently inspectable settlement/delivery and outcome artifacts. Do not reconstruct missing ancestors or infer outcome truth from labels.
3. Assign two independent blind reviewers and an adjudicator, then freeze their records and the exclusion ledger. This step is external; no label has been fabricated here.
4. Provide the dedicated OpenAI test project key, isolated staging environment and verified project hard spend cap to run the identical approved dataset. These were previously confirmed unavailable.
5. Resolve the reputation outcome-attestation gap and review the Jev/provider seam as separate changes. Obtain explicit authorization before enabling model influence, billing, signing, settlement or deployment.

Until then, `OPENAI_DECISIONS_SHADOW_ENABLED=false`. The four-receipt append-only authority remains unchanged by this branch.

## Validation on this branch

The final full suite ran against a disposable local PostgreSQL instance with the canonical and economic test URLs: **268 files passed, 1,923 tests passed, one existing test skipped**. The new read-only integration test created a disposable schema and SELECT-only role, read an O→J→X→E test chain, and confirmed that a writable role is rejected. Its receipts were explicitly synthetic test data and were never counted as historical evidence. Typecheck, lint and build passed; `git diff --check` passed. The blocked reviewed-dataset manifest was offered to the live CLI, which exited before network dispatch and created no output file. No OpenAI request was made.
