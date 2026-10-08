# Receipt Tape v1

8 October 2026 · specification for review · `receipt-tape.v1`

**The signal can change. The receipt cannot.**

This specification defines the public evidence surface for Infopunks intelligence. It does not assert that the tape is deployed or that a real causal loop has already been verified. Current implementation gaps and validation are in the [code audit](ipx-causal-loop-audit-2026-10-08.md). Economic accounting has a separate namespace defined in the [economic specification](ipx-pltr-economic-mechanism-v1.md).

## 1. Purpose and authority

Make one complete causal sequence independently inspectable:

```text
MONITOR / reviewed evidence → Observation O1 → Judgment J1
External settlement + Harness task proof     → Execution X1
Reviewed task outcome                        → Evaluation E1
Current evidence O2 + frozen eligible history → Judgment J2
Frozen-input replay                          → causal revision witness
```

Radar records evidence and issues judgments. A judgment is an assessment; it is not by itself a spend capability. Harness/executor records task execution, and the selected rail provides settlement. The separate economic engine's authorization object, where used, must remain distinct from J. IPX holdings confer no judgment authority.

The four canonical receipt types remain Observation, Judgment, Execution and Evaluation. A publication manifest, assessment-attempt record, decision context and revision witness are supporting artifacts, not additional score-authority receipt types. Only qualifying Evaluations contribute to the production score projection. Tape rendering and economic ledgers cannot author scores.

## 2. Status and eligibility are separate dimensions

Every entry displays its namespace (`production`, `testnet`, `synthetic`, `historical_internal`), source environment, provenance class, verification result and metric eligibility. These values are derived by trusted ingestion and independent verification; a submitted `fixture: false` or `verified: true` is insufficient.

| Verification dimension | Required evidence |
| --- | --- |
| Byte integrity | Strict schema, canonical hash, exact parent bytes |
| Issuer authority | Trusted key registry and applicable signature/authenticated ingestion proof |
| Observation qualification | Scoped source, real artifact, collection time, freshness, reviewed facts |
| Settlement finality | Rail-specific transaction/log proof and finality rule |
| Task outcome | Actual output/artifact, task rubric and evaluation provenance |
| Causal replay | Frozen J2 context, designated E intervention and different replayed decisions |
| Availability/completeness | Export manifest, cursor coverage, accessible artifacts and declared gaps |

A valid hash is not proof that a source claim is true. A finalized payment is not proof that a task succeeded. An authenticated reviewer is not a permissionless oracle. Display each level separately; avoid one undifferentiated green “verified” badge.

## 3. Canonical receipt contract

Use the existing `canonical-receipts.v1` field names for historical receipts. Do not mutate them to add new provenance. New decision-context commitments require a separately versioned schema and migration before activation; the strict v1 schemas reject undeclared fields.

| Type | Existing fields displayed | Additional qualification contract |
| --- | --- | --- |
| Observation | `observation_id`, subject type/ID, `intent_hash`, source type/ID, observed/ingested times, expiry, evidence state/refs, provenance, payload/hash | Content-addressed source artifacts; trusted source identity; task/route scope; explicit fixture environment |
| Judgment | `judgment_id`, subject/intent, decision, confidence, threshold, reasons, cited IDs/parent hashes, issue/expiry times, policy, payment, issuer signature | Immutable decision-context hash committing the actual assessment snapshot and decision algorithm; required on newly qualifying J2 |
| Execution | `execution_id`, `judgment_id`, parent hash, time, rail/ref, request/response hashes, signature, status, cost, latency, artifact refs, verification/capability metadata | Trusted proof-profile identity; finalized task settlement or explicitly supported non-payment task proof; preserved proof submission and signature; no reused settlement/task authority |
| Evaluation | `evaluation_id`, `execution_id`, parent hash, time, outcome, reasons, evidence refs, evaluator, policy, delta, labels | Versioned evaluation rubric and hashed artifacts; acceptance boundary; reproducible outcome or disclosed authenticated human review |

For external EVM execution profiles, preserve the original signed proof body as well as the stored receipt: the receipt's submission hash alone does not contain everything needed to reverify its signature. Preserve receipt/log and block evidence, network/token identities, signer/recipient, atomic amount and finality metadata. For economic-engine executors, preserve capability, operation, adapter version and its independently verified outcome. Solana requires its own finalized transaction and task proof; current telemetry alone does not qualify a settled learning loop.

Existing receipt hashing uses `receiptIntegrityService.ts`: recursive lexical JSON object-key order, arrays in semantic order, finite JSON values only, SHA-256 over `{kind, payload}` without `receipt_hash`. Judgment `issuer_signature` is detached and excluded from the receipt hash; verify it separately using its domain and trusted registry. Do not silently substitute the IPX economic ledger's JCS/`0x` hashing rules. Publish exact cross-language vectors and numeric constraints with the verifier.

## 4. Required decision context

The context frozen at **assessment/quote time**, before charging, contains:

- Exact normalized request and semantic task identity, route/provider scope, budget, settlement and confidence requirements.
- New assessment ID and retry key, previous comparable J ID/hash, assessment clock and evidence-expiry boundary.
- Complete reviewed facts and legacy response actually used, plus every O ID/hash and artifact digest.
- Decision engine version, source/build digest, configurable thresholds, confidence policy and rule identifiers. `receipt-authority.v1` alone does not identify the decision algorithm.
- History selection rules, accepted-ingestion high-water mark, exact eligible E IDs/hashes and policy versions, pre/post score, projection hash and eligibility exclusions.
- Decision before historical veto, decision after it, matched rules and any unrelated changes from J1.

History is selected by trusted acceptance boundary and event-time validity. A future-dated E cannot enter the snapshot; an E ingested after J2 cannot retroactively become J2's knowledge. One transactional snapshot must bind the observation selection and history selection, or an equivalent explicitly frozen input set must be persisted atomically. Settlement and retry paths reuse this context rather than recomputing it.

The new judgment commits `decision_context_hash` in its signed/hash-covered payload. Publish the context by that hash. A free-standing sidecar created later may serve as a retrospective audit, but cannot establish that it was the actual context consumed by the issued J2.

## 5. Causal revision witness

Proposed artifact `receipt-revision.v1`, domain-separated, canonical-hashed and signed by a disclosed issuer. Fields:

| Field | Meaning |
| --- | --- |
| `revision_id`, `subject_type`, `subject_id`, `task_scope_hash` | Stable comparison identity |
| `prior_judgment`, `next_judgment` | Each ID and receipt hash |
| `causal_evaluations` | Designated E IDs/hashes and full X/J/O ancestry |
| `decision_context_hash`, `history_snapshot_hash` | Committed J2 inputs and exact history |
| `decision_time`, `accepted_high_watermark` | Historical knowledge boundary |
| `replay_engine`, `engine_digest`, `rule_config_hash` | Pinned algorithm and rules |
| `with_evaluations`, `without_designated_evaluations` | Both replayed decisions, scores and reasons |
| `replay_bundle_hash`, `unrelated_changes` | Export binding and disclosed J1-to-J2 changes |
| `qualification`, `improvement_status`, `review_refs` | Causal status, separately measured quality and evidence |
| `witness_hash`, `issuer_signature`, `publication_manifest_hash` | Integrity, trust and publication commitment |

The counterfactual holds **J2's current** request, facts, legacy inputs, clock and rules constant, removing only the designated E set from J2's history. J1 is the historical comparison; replaying J1 with different current inputs is not the intervention. If the resulting decision category is unchanged, label “history consulted,” not “causal revision.” A reason, confidence or timestamp change alone does not qualify.

If E changes J2 but other J1-to-J2 facts also changed, disclose them. Do not claim E was the sole historical cause unless a frozen comparison establishes that stronger conclusion. Multiple necessary E receipts can form one causal set; they do not create multiple copies of the same revision metric.

## 6. Display and discovery

The terminal tape shows a compact row with time, subject/route, type, verdict/outcome, provenance status and shortened hash. Opening a row reveals full bytes, parents, children, artifacts, verification steps, payment versus task cost and publication coverage. J2 exposes “Why the judgment changed,” the designated E and replay comparison. Failed tasks and downgraded decisions receive the same visibility as successes.

Recommended plain-language states:

| State | Trigger |
| --- | --- |
| Observed | O exists; no issued J |
| Assessed — payment pending | Quoted paid assessment, no issued canonical receipt yet |
| Insufficient evidence — free | Assessment abstained; zero charge |
| Awaiting execution | Eligible J exists; no X |
| Settlement unproven | Executor attempt exists; finality/task proof missing |
| Awaiting evaluation | Eligible X; no qualifying E |
| Evaluated | Valid O/J/X/E ancestry and disclosed outcome |
| Loop closed | Evaluated task plus later eligible J committing that history |
| Judgment revised | Causal witness reproduces changed category |
| Improvement measured | Separate predeclared quality protocol passes |

A reverted payment or execution with no finalized settlement must remain visible in attempt/trace records. It cannot be forced into a receipt asserting a verified successful transfer. A finalized paid task with a failed or partial output may qualify an Execution and a contradicted/weakened Evaluation. No output means unknown quality until the rubric establishes an outcome.

Free insufficient-evidence cases with no observation belong in a supporting assessment-attempt stream. Do not manufacture an O or force them into v1's minimum-one-parent judgment schema. Preserve returned decision, reason, time, zero cost and request digest while respecting privacy.

## 7. Proposed API and export surface

These are **new contracts to implement**, not claims about existing endpoints.

| Proposed read endpoint | Contract |
| --- | --- |
| `GET /v1/receipt-tape` | Bounded cursor pagination; namespace/type/subject/time filters; immutable high-water mark; verification status and exclusions |
| `GET /v1/receipt-tape/loops/:id` | All four receipt stages, current O/J, missing edges, supporting context and witness |
| `GET /v1/receipt-tape/revisions/:id` | Full signed witness and replay bundle reference |
| `GET /v1/receipt-tape/metrics` | Snapshot-scoped counts, definitions, denominators, exclusions and coverage |
| `GET /v1/receipt-tape/exports/:manifestHash` | Immutable export manifest and content-addressed artifacts |

Existing individual receipt, issuer-key, score and attribution reads can supply components. Existing `/v1/receipts` remains explicitly labeled legacy/community intake. No public mutation endpoint is added by this specification. Page size default 50, maximum 200; opaque cursor binds filters, snapshot ID and sequence. Event time orders presentation; accepted sequence defines ingestion coverage and cursor continuity. Publish coverage start/end, high-water mark, known gaps, retention and verifier version. Unknown counts are `null`, never a fabricated zero.

Export manifest `receipt-tape.export.v1` includes IDs/hashes, namespaces, parent closure, context/witness digests, artifact locators/digests/media types, key-registry snapshot, engine/policy digests, acceptance boundary, excluded items, coverage and manifest signature. Content must be downloadable without a private Radar database. A signed manifest establishes publisher accountability; independent mirrors or external timestamp/root commitments are needed to detect publisher equivocation or history truncation. Database triggers alone do not prevent a privileged administrator replacing the database.

## 8. Public metric definitions

Use one primary metric: **Verified closed learning loops**, accompanied by **Causal judgment revisions** and **Outcome mix**. Do not call any of these “intelligence improvement.”

| Metric | Exact counting rule |
| --- | --- |
| Evaluated executions | Unique eligible X with one authoritative E; distinct task and settlement evidence |
| Verified closed learning loops | Unique eligible evaluated task whose E is included in a later eligible J's committed history, with complete export and verifiable knowledge boundary |
| Causal judgment revisions | Unique later J with qualifying category-changing witness; report designated E set; count each J once |
| Outcome mix | Confirmed/weakened/contradicted over evaluated executions; counts plus denominator |
| Evaluation coverage | Eligible evaluated X / eligible finalized X in a disclosed execution-time cohort; show pending count/age |
| Loop closure coverage | Closed eligible evaluated tasks / eligible evaluated tasks in the same cohort; show lag and unresolved tasks |
| Measured improvement | Separate task/risk quality protocol; `null` until evidence exists |

One E feeding many later judgments closes its original evaluated task once. One J consuming many E receipts can close several distinct tasks but is at most one revision. A loop need not change the decision to close; preserving a correct judgment is legitimate. Same-key retries add no counts. Publish settlement/task dedupe identity, exposure, evaluator concentration, namespace exclusions, and unique operators/subjects alongside totals. Verified settlement alone does not establish independent users or non-wash activity.

For v1 qualification, require distinct finalized task execution and independently reviewable artifact; group repeat attempts of the same task and flag self-funded/related-party activity. Publish exclusion rules and link excluded receipts. Do not reward closed-loop counts with token allocation, fee discounts or evaluator payments based on volume. Monetary cost alone is not Sybil resistance. Caps/weighting need a separately versioned policy; do not silently change the current score sum in a display layer.

Improvement requires a predeclared outcome rubric, suitable comparison cohort, cost/error denominators, measurement window and independently reviewed outcomes. Blocking a spend changes exposure but does not reveal its counterfactual result. False-block rate remains unmeasured without evidence. Track upheld, challenged and reversed evaluations, and report statistical uncertainty when quality claims become possible.

## 9. Corrections, privacy and retention

Never delete or rewrite an issued receipt to improve a chart. Publish signed correction/challenge artifacts pointing to original hashes. Until a supersession policy is implemented, current one-E-per-X rules reject replacement evaluations; show disputed state without adding another score contribution. A future policy must explicitly define when authority changes, preserve the original, and version replays.

Decide public eligibility before appending canonical public payloads. Store secrets/private outputs in access-controlled artifact storage; receipts can commit their digests and disclose availability limitations. A digest may reveal low-entropy private data; use reviewed commitments where needed. Do not remove fields from public receipt bytes and still claim the original hash verifies. Public loop qualification requires enough shareable evidence for independent review; private-only chains are separately counted as non-publicly-verifiable. Preserve issuer public keys, signatures and policy snapshots for historical replay, including rotation/revocation history.

## 10. Example and acceptance gate

The accompanying [local causal bundle](../output/ipx-strategic-review/causal-loop-fixture.json) was generated from current services. It is `SYNTHETIC_LOCAL_ONLY`: first J proceeds; E contradicts; score changes `0 → −15`; fixed-time J2 blocks; without E the same inputs proceed. Full O/J/X/E/J bytes and hashes are included. **Public qualifying-loop contribution: zero. Improvement: unmeasured.** It is a reference fixture, not the requested real-route proof.

Receipt Tape v1 is ready for production qualification only after these checks pass:

1. Actual route artifacts, proof profile and trusted issuer verify; every parent is retrievable by hash.
2. J2 commits its quote-time context and exact eligible history before payment; new assessment keys work while retries remain stable.
3. Offline replay reproduces J2; omitting only designated E changes its decision category.
4. Future/late evidence, forged proof markers, duplicate settlements/tasks, repeated evaluations and synthetic/internal chains cannot enter qualifying score history or public metrics.
5. PostgreSQL restart preserves receipt bytes, input snapshots, context binding and counts; privileged mutation/equivocation limits are disclosed and publication commitments are externally witnessed.
6. Failed, partial, missing, challenged and insufficient-evidence cases remain discoverable; zero-cost abstentions do not acquire fabricated parents.
7. Pagination/export covers the declared snapshot without truncation; unavailable evidence yields explicit incomplete status.
8. An independent reviewer validates one real bundle without relying on the public summary's assertions. Improvement remains a separate gate.

Implementation order: eligibility and ingestion boundary → versioned judgment context/migration → replay/witness exporter → tape API and completeness → restrained terminal display → one real independently reviewed loop → recurring immutable reporting. No token launch depends on a synthetic demonstration.
