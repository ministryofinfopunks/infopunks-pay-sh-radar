# IPX A2 decision-context completion — 8 October 2026

## Scope and checkout

Package **A2 only**, branch `codex/ipx-a2-decision-context`. Shared source HEAD was `55f05d6f6ac46603072662c91cb02d09ba879870`. All 136 existing modified/untracked files were copied byte-for-byte into an isolated checkout, checked for source/copy hash equality, and captured by baseline commit `cdd2500324a4f721a1572703df140545ae29cdeb`. The original shared checkout was not edited. This report describes local code and tests, not deployed behavior or production evidence. The A2 implementation commit is reported in the final handoff.

## Implemented

- `src/schemas/decisionContext.ts` defines a strict `pre-spend-decision-context.v1` record. It commits request and legacy response, observation IDs/hashes, contributing evaluation IDs/hashes/deltas, score projection and projection hash, the explicit committed-evaluation-set boundary, threshold/veto/TTL/amount/asset constants, rule version, assessment ID, policy hash, output and canonical context hash.
- `src/services/decisionContextService.ts` shares the pure decision rule between quote issuance and frozen-input replay. The verifier resolves each committed dependency, checks receipt ancestry and score projection, then recomputes the decision and validity window. `scripts/verify-decision-context.ts` accepts a local JSON bundle with full parent closure and issuer registry and reports hash, ancestry, replay and signature results. Missing issuer authentication fails the CLI's overall verdict.
- `src/services/judgmentService.ts` stores the context in the winning first quote before accepting a payment signature. Same-key retries use the frozen quote; a fresh key reassesses. A v2 paid judgment commits `decision_context_hash`; the response exposes that hash. Free insufficient-evidence responses remain free and do not create a canonical judgment, pending A6's assessment-attempt log.
- `src/persistence/canonicalReceiptStore.ts` provides immutable context storage in memory and PostgreSQL. Migration `20261008_018_decision_context` adds the context table, immutable triggers and a deferred v2 judgment-to-context check. Rollback refuses nonempty context or v2 judgment history. The enabled payment service checks this table at startup.
- The new v2 judgment schema and Ed25519 domain are separate from v1. Historical v1 serializer, hashes, signature domain and receipt rows are not rewritten. Internal and economic-engine v1 issuance remains supported. `GET /v1/receipt-spine/judgment/:id/context` exports the context with a replay result; OpenAPI describes it.
- Existing execution tests that intentionally turn paid receipts into unpaid examples explicitly construct v1 examples. PostgreSQL durability fixtures apply migration 018 when using paid v2 judgments.

## Evidence

| Check | Exact command / result |
| --- | --- |
| Focused context and legacy receipt tests | `npx vitest run tests/unit/execution-proof-service.test.ts tests/integration/execute-proof.test.ts tests/decision-context.test.ts` → 3 files, 15 tests passed. |
| Focused disposable PostgreSQL durability | `CANONICAL_RECEIPT_TEST_URL='postgresql://ahdilm@localhost:55463/postgres' npx vitest run tests/integration/judgment-payment-durability.test.ts tests/integration/judgment-issuer-durability.test.ts tests/integration/execution-proof-durability.test.ts tests/integration/rh-usdg-accounting-durability.test.ts tests/decision-context.test.ts` → 5 files, 6 tests passed. This included restart/replay, immutable context and rollback refusal. |
| Full application suite | `CANONICAL_RECEIPT_TEST_URL='postgresql://ahdilm@localhost:55463/postgres' npm test` → 260 files passed, 1 skipped; 1,874 tests passed, 2 skipped. Its run preceded type-only `as const` fixes in two test fixtures; focused runtime tests already passed and final typecheck/build covered those fixes. |
| Final static and build checks | `npm run typecheck && npm run lint && npm run build` → exit 0, after the type-only fixes. Build reported the existing large-chunk warning. |
| Whitespace | `git diff --check` → exit 0. |

SHA-256: migration 018 up `388aab7dcfe4b5c41052dd5213a55ee81886b769ff96fef7b1ac93b34697a815`; replay service `5e85a56dfe3315f66d5c2b46f01dcf5e563bb417b4230398a770873ef2d9be69`; context schema `179770b8b0979b28c4fa60cfcd392bf20564fec8f74fcba3e4d3c0c2da189ce3`; offline verifier `d1f2d44b5390ba78e54ea75ce7d4efd41cfd098af0468c34396e520bdc1ff380`.

## Compatibility, limitations and gate

The v1 code path and records remain readable. Migration 018 is additive for historical rows but **required before enabling new paid assessments**. New receipts use a distinct v2 hash and signing domain, so consumers that validate judgment versions must understand v2 before consuming new paid receipts. Context export contains the original request and legacy assessment; operators should review public disclosure before deploying it.

A2 freezes the exact observed evaluation set and projection at quote time. It does **not** prove that those evaluations were eligible, their outcome classifications correct, or their issuer times trustworthy. The committed set boundary is not yet a server acceptance sequence; A5 must add that boundary without retroactively changing v2 history. The offline verifier needs complete parent receipts and a trusted issuer registry for a public authenticated verdict. No genuine route, finalized task output, production signer registry or deployment was verified here.

**A2 local package: PASS. G0–G6: HOLD.** Next numbered package: **A3**, to separate receipt observability from score eligibility and prevent reused/unverified execution proof from qualifying.
