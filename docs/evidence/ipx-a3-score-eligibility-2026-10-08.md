# IPX A3 score-eligibility completion — 8 October 2026

## Scope

This package separates execution-receipt observability from score authority. It was implemented in the isolated `codex/ipx-a2-decision-context` checkout after A2. It does not claim production settlement, task-output verification, or a release gate result.

## Implemented

- Execution receipts have an optional, strict `score_eligibility` record. Only `executionProofService`, after a successful external settlement and payload verification, emits `qualifying / external_proof_gateway.v1`.
- The derived score service requires a qualifying marker, the proof-gateway intake, and an exact proof-profile match. Internal, legacy and synthetic receipts remain append-only and inspectable but contribute no evaluation score.
- Receipt-authority validation rejects a qualifying marker unless it is bound to a verified settlement and has the exact trusted proof-gateway shape.
- The canonical internal execution endpoint excludes `score_eligibility`, so an administrative caller cannot submit the qualification marker over HTTP.
- Migration `20261008_019_execution_score_eligibility` adds partial unique indexes for qualifying gateway receipts by settlement identity and judgment. Rollback refuses while qualifying history remains.

## Evidence

| Check | Exact result |
| --- | --- |
| A3 eligibility and affected projection tests | `npx vitest run tests/execution-score-eligibility.test.ts tests/unit/derived-score-service.test.ts tests/integration/evaluate.test.ts tests/integration/derived-score-projection.test.ts tests/integration/evaluation-judgment-feedback.test.ts tests/decision-context.test.ts` → 5 files passed, 1 skipped; 13 tests passed, 1 skipped. |
| A3 type safety | `npm run typecheck` → exit 0. |
| Disposable PostgreSQL replay protection | `CANONICAL_RECEIPT_TEST_URL='postgresql://ahdilm@localhost:55464/postgres' npx vitest run tests/integration/execution-proof-durability.test.ts` → 1 file, 1 test passed. It applied migration 019, replayed the proof after restart, rejected duplicate authorization/settlement, and refused rollback after qualifying history. |
| Whitespace | `git diff --check` → exit 0. |

## Limits and next package

The database uniqueness key is deliberately conservative: one qualifying external settlement per network and one per judgment. The present receipt schema does not yet carry a canonical transaction log index or task-attempt identifier, so valid multi-event transaction aggregation is intentionally not accepted. A4 must make outcome labels depend on versioned rubrics and pinned task-output artifacts; A5 must add trusted acceptance ordering and server-time boundaries. G0–G6 remain HOLD.
