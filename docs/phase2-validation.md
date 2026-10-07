# Phase 2 gate record — 2026-10-07

Prerequisite receipt spine / authority lockdown: 4 files, 41 tests passed, no skips, including six dedicated local PostgreSQL cases. No production database was used.

Phase 2 final full suite: **231 files passed; 1707 passed, 1 skipped, 1708 total**. The existing separate PostgreSQL resilience termination test remains skipped. Canonical PostgreSQL tests ran. Typecheck, lint, build and `git diff --check` passed. After final idempotency-header/documentation refinements, focused payment, SDK and CORS checks passed: 7 files, 48 tests. The build retains its existing large frontend chunk warning.

New coverage includes canonical adapter mappings, absent/stale/fixture/unresolved/incomplete/scoped evidence gates, confidence, negative and bounded policy, observation citation, expiry, 402 headers, invalid signatures, verified paid receipts, response headers, concurrent retry protection, ambiguous settlement blocking, durable restart replay, recovery after settlement persistence and zero score mutation.

Official dependencies: `@x402/core` and `@x402/evm` 2.28.0. Base USDC code path tested with an explicit mock facilitator. **No live settlement network verified**; paid operation defaults disabled. Solana unsupported. Configuration checks and facilitator capability discovery fail closed. Production migration/configuration and an operator-approved live settlement smoke test remain external deployment work.

Local memory-adapter benchmark, 200 samples per path, explicit mocked facilitator: insufficient evidence p95 **0.1033 ms**, paid replay p95 **0.2768 ms**. These are development service measurements, not production PostgreSQL SLO proof. Instrumentation separates facilitator time from local processing. See `phase2-canonical-judgments.md` for contract, mappings and recovery behavior.

Phase 3 began only after these gates passed. No Phase 4 work is authorized by this record.

Final combined validation later enabled the real PostgreSQL resilience case and passed with no skipped tests. See `phases2-3-validation.md` for the final count, additional authority-bypass regression and PostgreSQL/fresh-judgment measurements.
