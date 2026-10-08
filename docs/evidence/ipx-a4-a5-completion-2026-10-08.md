# IPX A4/A5 local implementation evidence — 8 October 2026

Branch: `codex/ipx-a4-a6`; base `c56ca7e`. This is source and disposable-test evidence, not a live causal route.

A4 adds `task-output.v1` deterministic classification. A bounded raw output artifact is stored in the immutable E receipt as base64 with a SHA-256 byte digest. Replay decodes strict base64/UTF-8 JSON, checks task identity and the signed execution response commitment, and derives confirmed/weakened/contradicted from `success`, `complete` and execution status. The submitted label is retained as `proposed_outcome`; a conflict is rejected. Classification records reviewer identity and public receipt replay challenge method. Bare administrator labels, missing bytes, fabricated refs, unsupported signatures, conflicting outputs, and synthetic/nonqualifying parents do not contribute to scores. Historical E receipts remain parseable and are never reinterpreted as classified.

A5 adds server-owned acceptance sequence/time sidecars, immutable PostgreSQL tables, a quarantine table for future-dated E, and a serialized acceptance writer. New `pre-spend-decision-context.v2` records its accepted-sequence boundary before projection. Score projection filters evaluations at that boundary; its receipt IDs and hashes remain frozen across quote, payment, settle and retry. Existing v1 contexts continue to replay with their original semantics. Migration `20261008_020_receipt_acceptance` is additive and refuses rollback after accepted/quarantined history or v2 contexts.

Validation at worktree before commit:

- `npm run typecheck`: PASS.
- `npx vitest run tests/evaluation-classification.test.ts tests/execution-score-eligibility.test.ts tests/unit/derived-score-service.test.ts tests/integration/evaluation-judgment-feedback.test.ts tests/decision-context.test.ts`: 5 files, 14 tests PASS.
- `npx vitest run tests/acceptance-history.test.ts`: 2 PASS.
- Disposable PostgreSQL on localhost:55465, 7-file focused run including migration, restart, payment/issuer/proof durability and receipt spine: 7 files, 15 tests PASS. No production data used.

Limits: the rubric covers a signed-response JSON task result and cannot assert semantic quality of arbitrary outputs. There is no published real route, independent reviewer signature, or systematic improvement measurement. G0/G1 remain HOLD pending A6 and external proof. Timestamp quarantine currently applies to evaluations; other issuer-time policies need further review before G0.
