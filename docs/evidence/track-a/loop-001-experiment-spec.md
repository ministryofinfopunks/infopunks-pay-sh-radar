# LOOP-001 — real-evidence paid route experiment specification

**Status: proposed; not executed.** This is a narrow qualification experiment for the existing paid canonical pre-spend path. It does not prove or claim that the separate IPX economic judgment engine consumes learning history, and it does not claim generalized model improvement. No fixture, mocked facilitator, local simulation, seeded artifact, or synthetic score change may satisfy any experiment stage.

## Experiment unit and bounded task

- **Candidate task:** translate one fixed, short Spanish operational sentence into English through the live Pay.sh `Alibaba Machine Translation General` service route (the route name appears in existing harness/sample content only and is not proof that a live offer exists). At preflight, bind the exact live catalog `route_id`, `provider_id`, service/endpoint, request schema, provider recipient, quote, and route revision. If this exact live route cannot be resolved and verified, mark LOOP-001 blocked; do not substitute fixture IDs or silently choose a different task.
- **Task input:** a reviewer-approved, non-sensitive, fixed Spanish sentence with a published SHA-256 digest and a human-verified reference translation. The actual prompt bytes and exact output bytes are retained as artifacts. No personal or confidential text.
- **Risk cap:** one task execution, no retries that can charge again, provider task amount at most USD 1.00 equivalent in Base USDC; a lower route-specific cap is binding. Separate pre-spend judgment charge is shown as its own item, capped at the operator-approved minimal supported amount. If actual quotes exceed either declared cap or a fee/gas ceiling fixed before payment, abort without settlement.
- **Route scope:** `/v1/pre-spend/check` only. J1 allows only the named route, provider, service, request digest, maximum amount, Base USDC asset, signer/payer, recipient, and bounded task. No approval is implied for any other route or intent.

## Required qualifications before O1/J1

1. **Provider/source:** live Pay.sh catalog fetch with TLS and source timestamp; exact route is active and paid, offer is directly attributable to the provider, terms/recipient are current, and no local seed/fallback/cache fixture supplied the offer. Record source response digest, fetch time, catalog revision, provider identity and provenance. Independently verify provider account/endpoint and status/outage policy. A live catalog entry alone does not prove endpoint control or fulfillment.
2. **Task/API:** request/response schema and endpoint are pinned; route's unit price and maximum are known; one bounded request is sufficient; no write, financial, irreversible, personal-data or high-impact operation; response can be retained and independently evaluated.
3. **Pre-spend evidence:** an authorized reviewer has materialized fresh `reviewed_judgment_facts` for this exact subject and intent with live provenance, required confidence, correct settlement, exact route, max cost, signer/recipient, request hash, and `bounded_test_allowed=true`. No community receipt, seeded observation, synthetic fixture, or stale fact qualifies.
4. **Issuer/payment:** production-grade signed judgment issuer/key registry and canonical-receipt PostgreSQL storage are active; x402 V2 facilitator advertises exact Base USDC terms; merchant pay-to and resource URL are verified. Operator has explicitly authorized a single minimal judgment fee. Never include private keys in the publication bundle.
5. **Execution proof:** trusted signer EOA is independently registered; a read-only Base RPC is configured for chain 8453 and finalized receipt retrieval; provider-recipient mapping is independently verified. Judgment fee settlement and provider task settlement are separate, with distinct transaction identities and cost accounting.
6. **Reviewer independence:** task evaluator is independent of the payer, provider, route operator, and judgment signer; conflicts are disclosed. A second reviewer can retrieve and replay the artifact/rubric.
7. **System gates:** A1–A3 acceptance tests pass on frozen commit; migration readiness is operator-verified in a separate authorized environment; test harness demonstrates negative controls on local disposable data; no live write path is enabled by the experiment spec alone.

If a precondition is absent, report `NOT_RUN` with the missing dependency. Do not produce or imply a successful O/J/X/E/J chain.

## Required sequence and artifacts

| Stage | Required record and boundary |
| --- | --- |
| **O1 — Observation** | Fresh signed/reviewed route facts and live catalog source, exact request scope/hash, amount cap and expiry, provider/recipient/signer, settlement profile, source timestamps/digests and reviewer. Bind all raw source artifacts by content digest. |
| **J1 — Judgment** | Paid `/v1/pre-spend/check` call, explicit new assessment key, canonical signed receipt and committed `decision_context_hash`; quote-time snapshot includes all O IDs/hashes, legacy response, policy/engine build and rules, thresholds, exact history IDs/hashes, projection, acceptance high-water mark, exclusions and cost. Archive request/response, `PAYMENT-REQUIRED`, facilitator verification/settlement evidence, `PAYMENT-RESPONSE`, transaction identity when exposed, and separately reconcile judgment fee. J1 must be `proceed` or explicitly bounded `test_spend_first`, never inferred from HTTP 200. |
| **X1 — External execution** | Exactly one external request to pinned provider with authorized payload. Capture complete raw request and response, endpoint/route revisions, timestamps, HTTP status, request/response digests, provider job/request ID, latency, artifact bytes, task settlement receipt and transaction. Submit `base_usdc_external.v1` proof with EIP-191 signer message, signature, exact request hash, response hash, actual cost and artifact references. Independently retrieve Base receipt and finalized height; verify successful canonical receipt, USDC Transfer token/from/to/amount, signer=sender, recipient, authorization window and uniqueness. Retain RPC endpoint/client/version and verification output. A transaction hash or signed claim alone is insufficient. |
| **E1 — Reviewed evaluation** | One versioned translation rubric fixed before X1; actual output and reference digests; reviewer identity/provenance and conflicts; rubric version, language pair, exact scoring answers, notes, decision and time. Require a second independent reviewer to reproduce or challenge. Attach full task artifacts or durable, access-controlled retrieval instructions plus digests. Do not infer translation quality from successful payment or HTTP 2xx. |
| **J2 — Subsequent judgment** | Fresh explicit assessment key; same semantic task scope, route and request digest; O2 either newly reviewed and fresh or explicitly the same still-valid O1. Context commits J1 and E1 eligible history, accepted sequence/high-water mark and all current inputs before settlement. J2 is a new canonical judgment, not a retry. Include payment/settlement evidence separately if charged. |

### Predeclared evaluation rubric

For the single pinned sentence, reviewers independently compare output to the pre-published human-approved reference:

- Meaning preservation: 0–4 (4 all propositions and polarity preserved; 0 material reversal/omission).
- Named entities, quantities and operational terms: 0–2 (2 all exact; 0 material change).
- English grammar and readability: 0–2.
- Unsupported additions or omissions: 0–2 (2 none; 0 materially misleading additions/omissions).

`confirmed` requires total ≥9/10, meaning ≥4, and no material unsupported addition. `weakened` means usable but a score 6–8 or a noncritical omission. `contradicted` means score ≤5, material meaning/polarity/quantity error, unsafe/irrelevant output, or no usable output after finalized task settlement. Missing artifact, ambiguous language, provider outage, or evaluator conflict is `unrated/disputed`, not a forced outcome or score delta. Rubric weights, reference, and thresholds are immutable for this experiment and reviewer agreement is reported.

## Decision-context commitment and history boundary

The context must be created and durably committed atomically at quote/assessment time, before any judgment fee or task payment. Bind exact normalized request and semantic task identity, route/provider, budget and settlement, O1/O2 hashes and source artifacts, legacy output, engine source/build digest, thresholds/rules, previous J1 identity/hash, fresh assessment key, evaluator policy, eligible E set, projected score/outcome, and acceptance high-water mark. Hash with the receipt-tape-defined canonical serializer and publish the exact canonical bytes. A later-created sidecar is retrospective and cannot stand in for J2's consumed context.

Eligible history is limited to independently qualified, finalized external task executions, verified receipt ancestry, accepted/reviewed evaluations, matching subject/task scope, and records accepted at or before J2's committed high-water mark and valid at J2 event time. Same task settlement, duplicated payment, synthetic/internal receipts, future-dated evidence, later-ingested evidence, disputed evaluations, unrelated routes, and private-only unreviewable chains are excluded and listed with reasons. History selection is deterministic and immutable for the witness. A late E can inform a later assessment only.

## Independent counterfactual replay

An independent verifier downloads the publication bundle without Radar database access, verifies signature/key registry and every receipt/context/artifact digest, checks full O→J1→X1→E1 ancestry and externally finalized settlement, and reconstructs the exact accepted-history boundary. Pin verifier build, decision-engine build, policy/rubric versions, and canonicalization test vectors.

Replay J2 twice at its recorded time with the same request, O2/current facts, legacy response, engine and rules:

1. all eligible frozen history, including designated E1;
2. identical inputs with only E1 removed.

Record decision, confidence, reasons, score, exact E set and replay digest. A causal revision is accepted only if the decision category changes and all other inputs are identical. If the category does not change, state “history consulted; no causal revision.” If any other O, route, policy, price, threshold, evaluator or engine input changed from J1 to J2, disclose it and do not attribute the entire change to E1. This single-task experiment cannot establish statistical improvement; report improvement as `null / unmeasured`.

## Publication bundle format

Publish one immutable `receipt-tape.export.v1` directory/archive with:

- `manifest.json`: bundle ID, schema, experiment identifier, frozen source/build SHA, creation time, snapshot/high-water mark, coverage, parents, receipt IDs/hashes, exact artifact digests/media types, excluded items/reasons, verifier/rubric/policy versions, completeness and signature/key ID.
- `receipts/O1.json`, `J1.json`, `X1.json`, `E1.json`, `J2.json`: exact canonical receipt bytes; do not normalize/re-serialize before hashing.
- `contexts/J1.context.json`, `contexts/J2.context.json`: exact committed context bytes and hashes.
- `artifacts/`: catalog response excerpt, request/response bytes, translation reference, reviewer worksheets, facilitator settlement evidence, external Base transaction receipt/log proof, finality response and verifier transcript; sensitive headers/secrets removed while preserving digest-covered original artifacts in access-controlled review storage.
- `revision/receipt-revision.v1.json`: signed witness with prior/next J, causal E set, hashes, context, history snapshot, replay engine digest, both replay outputs, unrelated changes, qualification and `improvement_status: null`.
- `verification/`: offline verifier invocation, software digest, public keys/trust registry snapshot and expected result; never private keys.
- `README.md`: exact reproduction and verification steps, coverage/omissions, task-vs-judgment cost breakdown, privacy limits and the statement “one real task; no general improvement claim.”

Sign the manifest and witness with a disclosed issuer. An external timestamp/root or independent mirror is needed to detect later publisher equivocation/truncation; the bundle signature alone cannot prove that no hidden records existed. Publish complete failed/unproven attempts as attempts, without labeling them successful X1.

## Negative security tests

Before one real call, A1–A3 local tests must demonstrate:

- Forged `verification` or `verified=true` JSON on the internal receipt writer cannot enter eligible score/history.
- Fixture, synthetic, legacy CALL, community and mock-payment records are excluded from qualifying metrics.
- Same Base USDC transaction, provider task ID, settlement reference or authorization cannot be reused through aliases or different intake paths.
- Wrong chain/token/from/to/amount, failed/unfinalized receipt, wrong signer, wrong request hash, altered output, stale observation, out-of-window or future execution all fail closed.
- Future-dated and later-accepted E cannot change J2; delayed evidence does not retroactively enter frozen context.
- Same assessment key retry returns same judgment and cannot charge twice; fresh key is required for J2; changed request under same key conflicts.
- Repeated E for one X, changed evaluation after issue, forged reviewer identity/signature, artifact digest mismatch, rubric mismatch and undisclosed conflict are rejected or marked disputed without score contribution.
- Counterfactual replay changes only E1 membership; modified context, history, engine, threshold or artifact invalidates witness.
- Incomplete cursor, missing parent, missing artifact, truncated export, publication signature failure or unavailable DB yields incomplete/unknown, never zero-filled success.
- Free insufficient-evidence attempt has no charge and no fabricated O/J parents; it remains separately discoverable.

## Measurable success and abort criteria

**Success for LOOP-001 completion** requires all of the following: exact live route qualification; one actual capped Base USDC provider settlement with finalized independently verified transfer; one retrievable output artifact; independently reproducible E1; J1 and J2 signed receipts with context commitments; complete durable O1→J1→X1→E1→J2 ancestry surviving process restart; offline verifier reproduces both J2 replays; all designated security tests pass; second reviewer signs the review result; and publication bundle is complete, verifiable and mirrored. Report each stage as pass/fail/not-run. Report task outcome, total exposure, judgment fee, task spend, latency, reviewer agreement, and any failures. Improvement stays unmeasured.

Abort before payment for any missing credential/qualification, live offer mismatch, provider or recipient ambiguity, quote above cap, unavailable verifier/storage, missing reviewer, or failed negative test. After an ambiguous payment result, do not retry settlement; reconcile through the existing operator procedure. Any failed or partial paid execution remains visible as an attempt and may receive a contradicted/weakened evaluation only when the rubric supports it.

## External access and approval dependencies

- Authorized live Pay.sh catalog/API access and a verified provider endpoint/recipient.
- Operator-controlled judgment issuer signing service, production-grade canonical Postgres, facilitator Base USDC V2 configuration and merchant pay-to; no key material is included here.
- Independent funded test payer wallet and one explicitly authorized minimal judgment fee plus one task payment/gas allowance. No payment is authorized by this specification.
- Trusted read-only Base RPC with finality data, signer registry, and operator migration/readiness checks.
- Independent bilingual reviewers and access-controlled artifact publication/review storage; public artifact redaction review.
- A1–A3 implementation, frozen acceptance suite, and independent witness/verifier build.

Absent these dependencies, experiment state remains `NOT_RUN`; the release remains HOLD. A0 accessed none of the external payment, key, production database, or deployment dependencies.
