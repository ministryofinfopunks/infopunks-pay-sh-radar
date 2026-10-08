# Phase 4: evaluation and derived performance memory

Authority remains `EvaluationService → EvaluationScorePolicy → EvaluationReceipt.score_delta → derived projection`.
Without a valid evaluation and its Observation → Judgment → Execution ancestry there is no contribution.

## Evaluation

`POST /v1/evaluate` accepts the strict `EvaluateRequestSchema`; all eight snake/camel score, confidence, trust and reputation delta fields are forbidden. Authenticate with the existing admin bearer credential and use `evaluator: {type: "internal", id: "canonical-admin"}`. A caller claiming another identity or providing an unsupported signature fails closed. This verifies operator provenance through the existing authentication boundary; it does not claim cryptographic evaluation verification. Trusted in-process creation records `internal/evaluation-service` instead. New V1 receipts require explicit internal provenance; historical Phase 1 receipts remain replayable under their original policy and hash.

`SCORE_POLICY_V1` (`score-policy.v1`) assigns confirmed +5, weakened -2, contradicted -15. These are application weights, not universal protocol values. The historical `receipt-authority.v1` policy remains validation-only (+5/-2/-5); new issuance always uses V1. Canonical receipt inputs (including issuance time), evaluator and policy produce identical receipt material. HTTP retries use a durable evaluation ID derived from principal and idempotency key and a stored canonical request fingerprint; issuance time is retained from the first write. Concurrent retry winners return that same receipt. Changed content returns 409. A second key for an already evaluated execution also returns 409. Outcomes are immutable; this phase adds no dispute protocol or destructive receipt API.

## Projection and judgment

`GET /v1/score/:subject` is a free read with no wallet or x402 payment. Default namespace is provider; `?subject_type=route` (or another subject type) selects a namespace. The existing `/v1/receipt-spine/scores/:subject_type/:subject_id` retains its compatible envelope and delegates to the same projection implementation.

The existing zero baseline and unbounded sum are preserved. `policy_version: derived-score.v1` identifies the versioned aggregation semantics; individual score-policy versions are committed by the projection hash. Receipts are ordered by evaluation time and lexical ID. The canonical hash includes subject, full resulting projection, ordered contributing IDs, receipt hashes and their score-policy versions. No mutable provider score is read. The PostgreSQL adapter uses the existing indexed subject/parent relationships to fetch the complete graph in one database snapshot. An ephemeral per-reconstruction parent map reduces duplicate reads; no independently authored score table or persistent cache is introduced.

`JudgmentService` reads the current projection after current evidence passes its gate. A historical total <= -10 vetoes an otherwise actionable decision and exposes `historical_execution_performance_degraded`, `derived_score_below_policy_threshold`, and, where applicable, `contradicted_evaluation_in_history`. Positive history cannot raise confidence, resolve stale/missing proof, grant spending permission, or cause an insufficient-evidence response to charge. The synchronous legacy PreSpendDecisionService and PreSpendIntelligenceService remain non-authoritative intake/adapters; the existing canonical judgment boundary owns historical feedback. Completed idempotent judgments retain their original decision; a subsequent judgment uses a fresh idempotency key.

Apply migration 014 after existing canonical migrations. It extends database policy constraints without changing append-only guards, parent foreign keys, or unique execution evaluation. Rollback refuses when V1 history exists rather than rewriting immutable history.

## Validation scope

Tests cover strict writes, authenticated provenance, complete-chain replay and corruption, append-only behavior, concurrent retries, deterministic reconstruction, causal omission in isolated test storage, legacy non-authority, a real service-driven proceed → contradicted outcome → do_not_spend transition, and score 100 with stale/insufficient evidence staying free and fail closed.

Local PostgreSQL benchmarks use 100 historical evaluations, 10 warmups and 100 samples per path. Judgment measures fresh internal decisions/quotes, excluding external settlement latency. Evaluation samples time only evaluation submission after execution append. This is local verification, not a production load guarantee or economic proof.
