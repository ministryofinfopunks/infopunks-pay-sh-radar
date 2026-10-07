# Canonical receipt authority (Phase 1)

Phase 0 configuration hardening passed before this work began. This phase changes receipt authority; it does not deploy Railway, migrate production data, alter traffic, or implement Phase 2.

The durable ancestry is `EvaluationReceipt → ExecutionReceipt → JudgmentReceipt → ObservationReceipt[]`. No legacy record is backfilled into this chain, and no synthetic ancestors are created for existing machine-execution artifacts.

## Authority map and compatibility

The pre-edit audit covered receipt schemas/repositories, migrations, evidence ledgers, claims/challenges, validation, Proof Check, Loop Check, machine receipt ingestion, Hermes, provider telemetry, and every score/confidence assignment. The authority boundary now is:

| Path | Previous ability / retained behavior | Current authority |
| --- | --- | --- |
| `preSpendRepository.createReceipt`, `POST /v1/receipts` | Receipt intake formerly updated linked route success timestamps/references and provider receipt counts. | Nonzero `confidence_delta` rejected with HTTP 400 `legacy_score_mutation_forbidden`; zero-delta intake retained. No provider/route mutation. Historical seed deltas are exposed as zero. |
| `preSpendRepository.submitValidation`, `POST /v1/validation/submit` | Formerly amended a receipt's confidence/validation/notes and provider quality/disputes, route blockers, service readiness. | Append validation annotations and intake metrics only. `confidence_adjustment` is retained as a community annotation, never applied. |
| `POST /v1/claims`, challenges | Community claim confidence, counters, status, evidence and review annotations. | Legitimate intake retained. Changes stay claim-local; no reputation projection. |
| `POST /v1/check`, Proof Check | Claim-local heuristic evidence labels and read-only decision hints. | No reputation mutation and no canonical spending authorization. |
| `POST /v1/loops/check`, loop repository | Keyword profiles formerly persisted an independently assigned run score. | Run score remains in the response shape but is zero, including legacy seeds; metadata and evidence links retained. |
| Pre-spend decision service and compatibility views | Legacy confidence/readiness and seeded provider/route reputation formerly granted approval. | Confidence/readiness and legacy provider reliability/route confidence are zero. Legacy checks retain caution, human-review and negative blocking states; never autonomous approval. Provider `safe_for_first_attempt` is false. |
| Hermes claim promotion / reputation ledger | Claim impacts formerly incremented/decremented raw trust and impact totals. | Impact magnitude, trust score, impact total are zero. Counts, decision history and claim-local review states remain readable. |
| Trust engine / intelligence snapshot | Catalog/monitor observations formerly emitted numeric provider trust assessments and trust-change events. | Diagnostic components remain; aggregate trust score is unknown (`null`). No new trust delta events are authored. Historical events remain readable and non-authoritative; loaded snapshots normalize old aggregate scores to unknown. |
| Machine execution receipt ingestion / proof ladder | Stores execution artifacts and artifact verification state. | No scalar reputation authority; cannot manufacture a canonical judgment/observation ancestry. |
| RH Chain reviewer/evidence ledger | Claim-local review confidence and publication annotations. | Existing intake/review semantics retained, no canonical reputation authority. |
| RH4663 signed resolution receipts | Read-only accuracy/streak projections from immutable signed protocol receipts. | Separate existing protocol statistics, not provider reputation deltas; protocol unchanged. |
| Signal/attention, search, capability, anomaly, wallet-risk, benchmark metrics | Pure relevance, measured performance, risk or attention projections. | Diagnostic domain metrics, not reputation writes and never canonical score authority. |
| Canonical evaluations | New reviewed terminal receipt. | Sole authoritative score delta: policy derives `confirmed = +5`, `weakened = -2`, `contradicted = -5`. |

These deliberate compatibility changes replace tests that expected receipt/validation/claim input to author confidence or grant legacy approval. Existing read routes and response field names remain available. A zero or unknown legacy score is not a canonical projection; use the canonical projection endpoint for reputation. Claim confidence and measurement confidence describe that record's evidence, not subject reputation.

## Schemas, hashing and replay

Strict Zod/TypeScript schemas live under `src/schemas/receipts/`. In addition to the minimum receipt fields, observations contain the JSON payload and an `intent_hash`; all receipts commit to `schema_version = canonical-receipts.v1`. Judgments record `charge` and the server's configured `proceed_confidence_threshold`, preserving historical replay if configuration later changes. Confidence uses the existing 0–100 convention.

Canonical JSON recursively sorts object keys, preserves array order, and rejects cycles and non-JSON values. SHA-256 hashes include receipt kind, all payload fields, schema/policy version and ordered parent hashes. Observation payload hashes are separately checked. Chain verification rereads and verifies every ancestor, scope, timestamp, evidence state, freshness through the judgment validity window, confidence and policy-derived delta. Hashes prove content integrity; they are not proof that a source told the truth. Reviewed source/evaluator access remains essential.

Every judgment cites at least one stored observation with matching subject/type/intent. `proceed` requires sufficient evidence with references, freshness through `valid_until`, and confidence at or above the committed configured threshold. An insufficient observation forces `insufficient_evidence`; this decision is free, has no payment reference, and cannot execute. Executions may follow only `proceed` or `test_spend_first` within the judgment window.

One terminal evaluation is allowed per execution. Corrections require a separately reviewed future policy; Phase 1 supplies no overwrite, replacement or repeated-delta mechanism. Subject scores are sums of verified evaluation deltas from a zero baseline, calculated on read. No independent score table or public score writer exists.

## Persistence and API

Migration: `migrations/20261007_011_canonical_receipt_spine.up.sql` (external-only established migration procedure). Four receipt tables and normalized `judgment_observations` enforce actual-ID primary keys, parent foreign keys and hashes, subject/time/hash indexes, and deferred multi-observation membership validation. UPDATE, DELETE and TRUNCATE are blocked by triggers on all five tables. Repositories expose only append/get/list, use isolated copies, reject conflicting IDs, and accept identical retries idempotently. PostgreSQL transactions atomically insert a judgment and all of its observation links. Memory storage is explicitly dev/test only and refuses production.

`POST /internal/receipt-spine/{observation,judgment,execution,evaluation}` requires the existing admin bearer token and returns private/no-store responses. Schemas reject client-supplied hashes, policy/threshold values and evaluation deltas. The server creates these fields. These are reviewed ingestion primitives, not community reputation submission routes. Keep the application database role free of table-owner/superuser privileges that can disable triggers.

`GET /v1/receipt-spine/{kind}/{id}` reads a canonical receipt. `GET /v1/receipt-spine/scores/{subject_type}/{subject_id}` replays evaluations and returns the derived score. No update/delete routes exist. Avoid putting secrets into provenance/payload/artifact references: receipt read APIs are public.

`RECEIPT_PROCEED_CONFIDENCE_THRESHOLD` defaults to 80, uses ordinary environment variables, and is bounded to the existing confidence scale. Production uses ordinary `DATABASE_URL` and existing shared PostgreSQL pool. There are no Railway SDK dependencies.

## Rollout, validation and limitations

Back up before applying migrations under the existing runbook. Deploy Phase 1 only after Phase 0 infrastructure checks pass. Apply the external migration before the API version that requires it; readiness includes its schema signatures. Exercise authenticated append → read → replay → score, restart the API, and verify durable reads before changing traffic. No production migration or Railway deployment is implied by local validation.

The down migration refuses when any canonical receipt exists. Rollback code/traffic first and retain receipt tables and durable memory. Do not erase receipts to make rollback pass.

Tests use repository conventions (flat `tests/` suites): receipt-integrity, receipt-authority, receipt-spine, legacy-write-lockdown. PostgreSQL integration requires `CANONICAL_RECEIPT_TEST_URL` pointing at a dedicated disposable instance. It creates a new isolated schema per run, never removes shared data, verifies durable replay, FKs and blocked mutations. Never point it at production. Default runs skip those PostgreSQL cases when no dedicated URL is configured.

Remaining operational work includes production migration/role verification, live evidence/evaluator provenance review, backup/restore parity and deployment smoke tests. Projection currently scans evaluation receipts and verifies ancestry on each request; optimize only with a verifiable derived cache in a future phase. Phase 2 has not begun.
