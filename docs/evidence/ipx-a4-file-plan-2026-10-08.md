# A4 file-level plan

Base: c56ca7e on codex/ipx-a4-a6. Shared main remains untouched.

- `src/schemas/evaluate.ts`, `src/schemas/receipts/evaluationReceipt.ts`: accept a bounded raw output artifact and record a versioned classification, provenance, byte hash and reviewer challenge metadata. Keep historical receipts parseable.
- `src/services/evaluationClassificationService.ts`: replayable task-output rubric, decode/check exact bytes, signed execution response commitment, parent task binding, conflicting proposal rejection.
- `src/services/evaluationService.ts`, `src/services/receiptAuthorityService.ts`, `src/services/derivedScoreService.ts`: distinguish proposal from authoritative classification; only classify/score when artifact evidence passes and parent execution is qualifying.
- `tests/evaluation-classification.test.ts`: positive and absent/fabricated/conflicting/malformed artifact cases; replay tamper detection and synthetic exclusion.
- `docs/evidence/ipx-execution-ledger-2026-10-08.md`: record actual package evidence after validation.

Compatibility: no mutation of v1 receipts or hashes. Existing administrative labels remain inspectable but nonqualifying. No production migration is needed for optional fields stored in immutable JSON receipts. Full external artifact provenance beyond the signed execution response commitment remains a G0 blocker.
