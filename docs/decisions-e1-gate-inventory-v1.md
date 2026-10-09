# E1 gate inventory v1

Audit date: 2026-10-09. Source baseline: `30a005bdde5d52bc9fb805106bd2985c87aa108e`.

The existing freeze template has 27 empty references. The preflight is tailored to the proposed **prospective Runway KORD run**, not to historical recovery. All 26 references below remain mandatory for that prospective candidate. The `environment.judgment_rail_facilitator_ref` field is the sole excluded reference: E1 uses an unpaid Judgment created inside disposable staging, so RH/USDG monetization is not on this run's critical path. The template retains the nullable field for compatibility. Removing it from the preflight does not waive any other E1 gate.

## Exact reference classification

| # | Reference | Current path | E1 classification and acceptable evidence |
|---:|---|---|---|
| 1 | `provider.response_schema_sha256` | Prospective | **Mandatory for this provider.** Pin the observed paid-response schema and hash it before request. No schema is published in the free catalog; status **UNKNOWN**. Historical path instead pins each original response's bytes and parser/schema version. |
| 2 | `provider.provider_request_id_field` | Prospective | **Mandatory for this provider.** Identify and freeze the provider-issued request identifier. Catalog does not document one; **UNKNOWN**. Historical path may use authentic provider-side request records if they bind uniquely to execution. |
| 3 | `provider.provider_side_record_verification_method` | Prospective | **Mandatory E1 outcome evidence.** A delivery record must be independently retrievable or authenticated and bound to response/request. Method **UNKNOWN**. An HTTP body hash or payment transaction alone is insufficient. |
| 4 | `provider.provider_identity_independent_verification_ref` | Prospective | **Mandatory.** Independently verify who operates the endpoint and the identity/key or other trust mechanism for the delivery artifact. Public catalog presence alone does not authenticate response provenance. |
| 5 | `task.reviewer_acceptance_of_source_overlap_ref` | Candidate-specific | **Mandatory if Runway/KORD remains selected.** Independent reviewer must accept or reject the disclosed NWS source overlap before freeze. If rejected, select a new task/provider and create a new run version. |
| 6 | `policy.deterministic_policy_commit` | Both paths | **Mandatory.** Pin the deterministic policy revision used for the Judgment and replay. Historical recovery requires the policy version applicable at the original event, not today's policy. |
| 7 | `policy.configuration_digest` | Both paths | **Mandatory.** Hash the effective policy/configuration inputs. Historical records need contemporaneous config or must be classified unreproducible. |
| 8 | `policy.evidence_freshness_limit_seconds` | Both paths | **Mandatory.** Freeze the permitted evidence age and decision clock. For the proposed KORD task it is 300 seconds, subject to reviewer acceptance and source timestamp checks. |
| 9 | `environment.isolated_staging_ref` | Prospective | **Mandatory.** Dedicated non-production environment and proof production endpoints are unreachable from the run harness. Historical path instead needs a read-only immutable snapshot/export reference. |
| 10 | `environment.dedicated_postgres_ref` | Prospective | **Mandatory.** Disposable dedicated PostgreSQL instance, segregated credentials, schema/version recorded. Historical path uses a read-only source snapshot/export, not a copied writable production database. |
| 11 | `environment.backup_restore_verification_ref` | Prospective | **Mandatory.** Prove an immutable archive and successful restore/replay in a separate disposable target. Historical path requires snapshot/export integrity and provenance. |
| 12 | `environment.test_judgment_issuer_id` | Prospective | **Mandatory.** Test-only issuer identity, unable to assert production authority. Historical path instead pins and independently validates historical issuer trust. |
| 13 | `environment.test_judgment_public_key_registry_sha256` | Prospective | **Mandatory.** Hash public test-key registry and verify signer identity. Historical path requires a trusted historical key registry and rotation/revocation evidence. |
| 14 | `environment.production_key_separation_review_ref` | Prospective | **Mandatory.** Independent review must demonstrate no production signing key is loaded or reachable. |
| 15 | `environment.base_rpc_verification_ref` | Prospective | **Mandatory for the proposed Base USDC execution.** Pin an independent read-only Base RPC and verifier procedure for finalized transfer, payer, recipient, asset, and amount. Historical path requires a suitable independent chain verifier for its actual settlement network. |
| 16 | `environment.judgment_rail_facilitator_ref` | Later release | **Not required for E1.** This is the RH/USDG paid Judgment monetization rail. E1 staging Judgment has zero charge and no payment receipt. Do not provision it for this run. It remains relevant only to separately approved paid-Judgment commercialization. |
| 17 | `approvals.operator_identity_ref` | Both paths | **Mandatory.** Identify the accountable operator. Historical access additionally requires data-owner authorization. |
| 18 | `approvals.operator_run_approval_ref` | Prospective | **Mandatory before any external request.** Approval is for this exact frozen run and environment. A separate historical access approval may replace it on the recovery path. |
| 19 | `approvals.financial_approval_ref` | Prospective | **Mandatory before the single paid request.** Must name the USDC and network-fee caps and payer wallet. No approval is present. Historical recovery has no prospective spend approval requirement. |
| 20 | `approvals.provider_request_approval_ref` | Prospective | **Mandatory before any request to Runway, including a quote/challenge request.** Must bind endpoint, method, query, and one-attempt limit. |
| 21 | `approvals.settlement_approval_ref` | Prospective | **Mandatory before transmitting a payment signature.** This is separate from permission to make a non-payment quote request. |
| 22 | `approvals.independent_blinded_reviewer_ref` | Prospective | **Mandatory.** Reviewer assesses pre-spend suitability without model output or later outcome. Historical reviewers must be independent of issuer/executor and document access to underlying artifacts. |
| 23 | `approvals.independent_outcome_reviewer_ref` | Both paths | **Mandatory for verified E.** Reviewer accepts the frozen outcome rubric only after inspecting authentic source artifacts, and before Evaluation append. |
| 24 | `freeze.frozen_at` | Prospective | **Mandatory before the first external request.** Use UTC timestamp and an immutable run version. Historical path instead timestamps/identifies the acquired immutable snapshot. |
| 25 | `freeze.freeze_content_sha256` | Prospective | **Mandatory.** Hash the complete run specification and referenced policy/schema artifacts. |
| 26 | `freeze.signed_by_operator_ref` | Prospective | **Mandatory.** Authenticated operator signature over the frozen content hash. |
| 27 | `freeze.signed_by_independent_reviewer_ref` | Prospective | **Mandatory.** Independent review signature over the same content hash. |

## Categorized path status

- **Mandatory E1 invariants:** authentic pre-spend evidence; deterministic reproducible Judgment; provider-side proof of the authorized action; independent outcome review against frozen criteria; valid append-only hashes, signatures, parent links, time order, and replay. Missing or unverified evidence cannot yield `ALLOW`. Only a verified Evaluation may affect reputation.
- **Prospective-only setup and approvals:** references 1–5 and 9–15 and 18–27 above as applicable. For this Runway candidate, all 26 mandatory references are presently missing or unresolved. The currently selected provider fails the qualification gate because response schema, request ID, delivery-record verification, and independent provider identity proof are undocumented.
- **Historical-recovery alternatives:** references 1–5, 9–15, and 18–27 are replaced where appropriate by immutable source snapshot/export authorization, historical issuer keys, contemporaneous policy/config, provider execution artifacts, independently verifiable settlement/outcome evidence, and reviewers' access/provenance records. Missing canonical access does not imply zero historical receipts.
- **Later release:** the one omitted preflight field (RH/USDG facilitator) is for paid Judgment monetization; OpenAI Decisions live performance/authorization influence, billing activation, production deployment, and production reputation writes are also out of scope. Provider settlement remains Base/USDC and independent from any later RH/USDG judgment rail.

## Hosting and database authority

Repository evidence declares a Render web service in [`render.yaml`](../render.yaml) and the Render runbook describes Render PostgreSQL and `DATABASE_URL` binding ([`render-production-runbook.md`](render-production-runbook.md)). These are deployment declarations/documentation, not proof of the active production service, current database resource, owner, or canonical receipt database. The Railway section in [`rh4663-production-runbook.md`](rh4663-production-runbook.md) describes parity/migration planning and explicitly says deployment or database migration has not occurred; it cannot establish Railway as canonical either. The available repository deployment record does not identify an active service/database owner.

**Conclusion:** Render is the repository-declared application host; the currently active production host, canonical PostgreSQL resource, and accountable database owner remain **UNRESOLVED**. Operator must provide Render service/resource IDs or authoritative replacement-host evidence, database owner, read-only role, snapshot/export lineage, and confirmation which database is canonical. No production connection was attempted.

## Gate owners

| Blocker | Required owner |
|---|---|
| Active host, canonical DB owner/resource, immutable snapshot/export | Infrastructure/database operator |
| Runway response schema, request ID, provider-side proof, identity trust | Runway operator/provider plus independent verifier |
| KORD/NWS source-overlap acceptance and pre-spend blind review | Independent reviewer |
| Disposable Postgres, test issuer, registry, backup/restore, production-key isolation, Base RPC | Staging/security operator; independent security reviewer for key separation |
| Frozen policy/config/digest, rubric and run hash | Infopunks policy owner and independent reviewer |
| Run, request, and separate settlement approvals and caps | Named operator and financial approver |
| Independent outcome review and evaluation authorization | Independent outcome reviewer |
