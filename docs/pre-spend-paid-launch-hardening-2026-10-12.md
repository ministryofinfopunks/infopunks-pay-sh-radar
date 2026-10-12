# Paid pre-spend hardening review — 2026-10-12

Decision: **HOLD for public paid launch; submit the endpoint fixes for draft review.** Local regression evidence does not qualify a deployed payment rail, issuer, database, or public-data policy.

## Revision and scope

- Branch: `codex/pre-spend-launch-hardening`.
- Base: `origin/codex/track-a-release-candidate`, `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`.
- Implementation revision: `b3c8ece9d1c76e2218d0eb119d2b880a4c671c1a`.
- The five-file `judgment_pre_spend_hardening.patch` applied cleanly after `git apply --check`. The local-only UI commit `62dbf6b` is excluded.
- Additions to the supplied patch: malformed decoded-payment JSON handling; private cache headers; wider service, HTTP and PostgreSQL regression coverage; matching OpenAPI; dependency advisory remediation.
- No migration, receipt schema, historical receipt/hash/signature, decision policy, financial deployment, or payment activation changes are included. The main checkout and frozen qualification evidence remain untouched.

The request mentioned an accompanying runbook without supplying its path or contents. The exact patch file was readable, but listing Downloads was denied by the host. A runbook-path clarification was requested; this report uses the request's three requirements and the checked-in A5.1 validation/staging documents. Acceptance against an additional runbook remains unverified.

## Endpoint acceptance

Both `POST /v1/pre-spend/check` and `POST /v1/decide` share these behaviors:

| Case | Result |
|---|---|
| Settled/complete paid retry without proof | 401 `paid_judgment_replay_proof_required`; no receipt or payment response |
| Different or malformed replay proof | 403 `paid_judgment_replay_proof_invalid` |
| Original verified proof | Same receipt, including its original validity window and signature; no facilitator verify or settlement call |
| Missing payment hash or unsuccessful settlement in a completed record | Replay rejected with 403 |
| Restart, or receipt publication failing after durable settlement | Original proof required before recovery; one settlement |
| Expired previously paid receipt | Historical receipt can replay with original proof; expiry does not become a new execution authorization |
| Expired unpaid quote | Existing 409 behavior retained; no settlement |
| Unknown chain, settlement, policy or other top-level fields | 400 at HTTP boundary; direct service calls also reject rather than strip fields |
| Empty, oversized or invalid idempotency key | 400 before reflection; 128 allowed characters accepted |
| Empty or >16,384-character payment header | 400 `invalid_payment_signature_length`, before key reflection |
| Base64 JSON null, scalar, array or missing accepted requirements on a new payment | Sanitized 400 before facilitator calls |
| Insufficient evidence | Existing free 200, zero cost, no receipt/challenge |

Proof equality is the SHA-256 hash of the complete canonical decoded x402 payload, matching the hash recorded before settlement. Equivalent JSON key order is accepted; an alternate payment/signature is not. Proofs are bearer credentials: clients must securely retain the original `PAYMENT-SIGNATURE` for retries. Only the hash is persisted, and these changes do not log the proof.

The paid handler sends `Cache-Control: private, no-store` before validation and rate limiting. Successful responses retain the SDK envelope and validated/derived `Idempotency-Key`. OpenAPI now derives the strict request schema from Zod, specifies header bounds and documents 401/403 replay outcomes. `preferred_settlement` remains a route-selection diagnostic, not a billing-network override; billing uses the operator-configured Base USDC or Robinhood USDG rail.

## Validation

Validation environment: local macOS ARM64, Node 25.6.1, npm 11.9.0, PostgreSQL 14.20. Tests use a newly created disposable local database, isolated schemas and mock facilitators; no live settlement or paid provider calls.

| Check | Result |
|---|---|
| Supplied patch focused regressions | PASS: 4 files, 40 tests |
| Final focused regressions, including PostgreSQL payment/signature recovery and OpenAPI | PASS: 7 files, 64 tests, no skips |
| Full PostgreSQL-backed suite | PASS: 273 files, 1,927 tests, no skips |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; large client bundle and existing Vite configuration/deprecation warnings remain |
| `npm run migrations:validate` | PASS: inventory 001–021, no errors; migration files unchanged |
| Dependency audit, production and complete trees | 0 high/critical/moderate; 1 low esbuild advisory remains |
| `git diff --check` | PASS |

Repeatable commands (replace the URL with a dedicated disposable database):

```sh
npm ci --no-audit --no-fund
export CANONICAL_RECEIPT_TEST_URL=postgresql:///pre_spend_hardening_20261012_01
export ECONOMIC_ENGINE_TEST_URL="$CANONICAL_RECEIPT_TEST_URL"
export POSTGRES_RESILIENCE_TEST_URL="$CANONICAL_RECEIPT_TEST_URL"
npm test -- tests/unit/x402-judgment.test.ts tests/unit/judgment-service.test.ts tests/integration/pre-spend-payment.test.ts tests/integration/pre-spend-judgment.test.ts tests/integration/judgment-payment-durability.test.ts tests/integration/judgment-issuer-durability.test.ts tests/openapi.test.ts --maxWorkers=1 --testTimeout=30000
npm test -- --maxWorkers=1 --testTimeout=30000
npm run typecheck
npm run lint
npm run build
npm run migrations:validate
npm audit --omit=dev
npm audit
```

Raw local output is retained under ignored `output/pre-spend-hardening/`. A committed validation manifest records results and log hashes. The audit exits nonzero for the remaining low advisory; it is not reported as an entirely clean audit.

Compatible dependency updates clear the candidate's 7 high production advisories and 8 high/2 moderate complete-tree advisories. Fastify is now 5.12.5, Vite 8.3.4 and Vitest 4.1.11. Vitest is constrained to the patched 4.x line to avoid an unrelated major/runtime change. Remaining GHSA-g7r4-m6w7-qqqr affects esbuild's development server on Windows; this local macOS build and documented Linux production image do not run that server. This is a documented residual, not formal operator risk acceptance.

## Reconciliation and remaining launch gates

| Previous finding / gate | Current disposition |
|---|---|
| Paid replay authenticated only by predictable agent/key | Fixed at the paid POST boundary; original verified proof is now required before both complete and settled recovery |
| Silently stripped unsupported request selectors | Fixed at both HTTP aliases and direct service boundary; strict OpenAPI matches |
| Unvalidated response header reflection | Fixed; invalid headers return before reflection |
| Decoder accepts arbitrary JSON | Additional fix; malformed payloads fail with sanitized client errors |
| Dependency advisories in the frozen candidate | High/moderate advisories cleared here; one low residual described above |
| Causal audit F1/F2/F4: omitted context, unverified score authority, unfrozen history | Track A already carries context v2, verified/classified-execution eligibility and accepted-sequence boundaries. Existing context, eligibility, acceptance-history and PostgreSQL tests are rerun in the full suite. Future-time quarantine extensions in the staging successor are separate work, not implied by this patch |
| Causal audit F3: independent outcome truth | Open for production evidence. Classification/replay fixtures do not establish independently reviewed real outcomes or improvement |
| Causal audit F5/F6: alternate engine and reassessment semantics | Scope remains the paid pre-spend path. A new assessment needs a fresh explicit key; an identical key is historical replay, not a new decision or charge |
| Causal audit F7/F8: public proof and moving validation target | Versioned tape/witness tooling exists; real public evidence remains unqualified. This branch records its exact implementation revision and separate local validation evidence |
| Public receipt/context/tape/free-attempt access | **Open access-policy gate.** Receipt IDs and request keys are deterministic; existing unauthenticated read routes can expose judgments, decision contexts and requests. This POST fix does not make the overall product private or tenant-isolated. Define approved public fields or add authenticated authorization/redaction before promising private paid intelligence |
| Later staging security fixes | The staging successor separately contains payment schema preflight, timestamp quarantine, legacy-write/Evaluation gates, tape/backfill migration 022, constant-time admin checks and runtime/image work. These are not ancestors of this requested frozen base. Review/integrate those changes and rerun qualification before using this endpoint PR as the final deployable release |
| A5.1 staging and paid operations | Still HOLD: verify deployed PostgreSQL/migration ledger and restore/replay, live catalog freshness, production issuer/rotation, facilitator compatibility and settlement reconciliation, edge limits and alerts. Existing local frozen evidence is not evidence for a newly deployed paid revision |
| Linux runtime/image qualification | Not executed here. The base Dockerfile still uses Node 20; runtime/image hardening and qualification belong to the later staging successor. Qualify the supported runtime, non-root image, SBOM and OS/application scan before launch |

The immutable receipt journal prevents uncertain settlement from being automatically retried. An ambiguous `settling` record remains 409 `payment_pending_reconciliation`; resolve it through the operator settlement/reconciliation procedure, never by resubmitting payment. Do not clear payment hashes to bypass this guard.

For application rollback, deploy the prior image with paid traffic disabled: the old implementation permits proofless paid replay. No database rollback or down migration is needed for this additive code change. Preserve the journal, receipts and issuer keys so subsequent recovery returns the original receipt without another charge.
