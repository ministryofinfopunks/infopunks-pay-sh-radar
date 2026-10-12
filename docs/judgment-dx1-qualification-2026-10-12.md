# Judgment DX-1 qualification — 2026-10-12

**HOLD for a public paid launch.** This is a reviewable implementation with local qualification, not a deployed or live-paid qualification. No production payment flag was enabled, no funded transaction was sent, no deployment occurred and no branch was merged into Track A or main.

Implementation commit: `9d02a6cf45772a65b82e27b559a068ed1a4875f8`, on isolated branch `codex/judgment-dx1`. Documentation and evidence are a subsequent commit so the implementation target is immutable. [Validation manifest](evidence/judgment-dx1/2026-10-12/validation-manifest.json) records source hashes, test counts and local image identities. [Changed-file inventory](evidence/judgment-dx1/2026-10-12/changed-files.md) lists every implementation and documentation/evidence change.

## Integration

[PR #7](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/7) remains OPEN/DRAFT at exact pushed head `b3c9a94fb8b0ab0f8ad5e027ed45f63347f02c79`. Remote Track A remains `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. All PR #7 changed files were inspected. Its draft status blocks integration; there are no submitted reviews or check results to treat as approval. GitHub reports mergeable/CLEAN, but that does not establish the requested integration qualification.

Repository settings allow merge, squash and rebase; no protected-branch rules or rulesets were returned. No merge command was issued. If an authorized reviewer later approves integration, refetch head/base and requirements, then merge using the exact expected head SHA and an allowed strategy. This branch starts at PR #7's verified head, excludes unrelated local Track A UI work, and is intended for a stacked draft review. Main and production remain untouched.

## Resulting behavior

An operator-issued tenant credential plus `createInfopunksClient().judge({intent,budget,subject})` provides one agent call. The SDK resolves the trusted agent, persists the assessment key, checks free/paid evidence, validates x402, obtains explicit fee approval, signs through a standard EVM signer adapter, submits once and verifies the available receipt evidence. [Developer guide and complete example](judgment-dx1-developer-guide.md) explain protected persistence, issuer pinning, limits and error handling. The package remains repository source, not a claimed published npm SDK.

The original SDK entry points and response compatibility envelope remain. Canonical receipt schemas, signing domains, frozen decision engine and migration files are unchanged. Tenant credentials are now required on authenticated deployments; old anonymous paid/private usage is intentionally closed. Versioned presentation and RPC payment-confirmation projections sit outside immutable receipt hashes. Free insufficient evidence cannot become a paid Judgment. Market/token/pool inputs cannot borrow service-provider policy.

Every listed workflow and failure state is typed. Observers receive non-secret states and cannot mutate spending authority. Fee authority requires the exact reviewed merchant, token, network, atomic ceiling and explicit approval callback; the input budget is an additional ceiling. An issued Judgment is neither execution authorization nor proof of a verified outcome.

## Validation

Final results against the implementation commit:

| Check | Passing | Failing / skipped |
|---|---:|---:|
| Full macOS ARM64 suite, Node 25.6.1 / PostgreSQL 14.20 | 277 files / 1,975 tests | 0 / 0 |
| Full native Linux ARM64 suite, Node 24.21.0 / PostgreSQL 16 | 277 files / 1,975 tests | 0 / 0 |
| Focused SDK, privacy, reconciliation, HTTP payment, real PostgreSQL, service, OpenAPI and configuration suite | 8 files / 111 tests | 0 / 0 |
| Typecheck, lint, production build, diff whitespace | PASS | 0 errors |
| Migration inventory / Linux runtime first apply / repeat apply | 001–021 / 21 applied / 0 newly applied | 0 failures |
| Actual Chrome desktop/mobile workflow | 2 viewports | 0 page errors / overflow |
| Production configuration missing required settings | Expected nonzero rejection | PASS |
| Linux production image private reads with no tenant registry | Expected 503, private/no-store | PASS |

Initial expanded qualification exposed 13 failing compatibility/privacy/UI expectations. They were investigated and corrected before final qualification; those exploratory runs are not reported as final passes. Subsequent changes to wallet-profile privacy added eight regression cases and the complete suites were rerun. Existing Vite configuration, React test `act`, Fastify deprecation and large-bundle warnings remain; none were hidden or reclassified as production proof.

Production and full dependency audits both have zero critical/high/moderate findings and **one low esbuild advisory**. Audit exits nonzero for that finding. No dependencies were added by DX-1. The low development-server residual remains documented, not formally accepted as production policy. OS-image vulnerability scanning/SBOM and native AMD64 qualification have not been completed.

All 40 implementation-file hashes are checked against the Linux build image. The runtime uses a digest-pinned Node 24 Bookworm image and runs as UID 1000. `/health` returns 200 with durable PostgreSQL; `/readyz` correctly returns 503 for the deliberately unqualified/disabled catalog. Private receipt/session/history endpoints return 503 without identity. Local container startup is runtime qualification, not deployment.

Raw logs are retained under ignored `output/judgment-dx1/`; the committed manifest carries their SHA-256 hashes. Synthetic mock proofs, disposable database backups and test issuer private keys are not committed.

## Regression evidence

| Requirement | Evidence |
|---|---|
| First free request, missing/stale evidence; first paid request | `judgment-dx-sdk`, `unit/judgment-service`, `integration/pre-spend-judgment`, `integration/pre-spend-payment` |
| Invalid challenge/proof, fee limits, unsupported networks, standard signer decline | `judgment-dx-sdk`, `unit/x402-judgment`, `integration/pre-spend-payment` |
| Concurrent paid calls, duplicate keys, different request/same key | SDK coalescing/conflict tests; server/payment journal concurrency and PostgreSQL compare-and-set tests |
| Historical replay and expired receipt; expired quote | SDK replay/expiry cases and existing Judgment/payment service regressions |
| Timeout before submission; timeout after commit; failed/ambiguous settlement | SDK loss/cancellation cases; real HTTP/SDK/PostgreSQL test reconstructs server/client and returns original receipt with one settlement |
| Restart durability and independent reconciliation | PostgreSQL durability suites; concurrent fresh repositories admit exactly one independently verified confirmation |
| Cross-tenant and unauthenticated reads | `judgment-private-access`, production legacy gates and actual Linux image HTTP rejection |
| RPC failure, reverted/unfinalized/mismatched nonce/token/payer/amount | `judgment-reconciliation`; every such case retains pending settlement and original payment hash |
| Cancellation, safe explicit resume, sensitive data | SDK state/error/session tests, header redaction, original-proof immutability and protected encrypted file-store cases |
| Receipt integrity, trust and replay | SDK parent/context/hash/signature tests; pinned issuer verified in real HTTP flow; existing acceptance/context/tape/issuer suites |

Mock facilitators establish deterministic software behavior only. Neither those tests nor mock RPC logs prove compatibility with a live facilitator, production token implementation or independent economic outcome.

## Authentication and isolation findings

`JUDGMENT_API_KEYS_JSON` binds opaque credentials to trusted tenant/agent pairs through stored digests. Constant-time comparisons, malformed/duplicate-registry rejection and operator-key separation are enforced. Request namespaces include the tenant. Agent IDs, wallet selectors, receipt IDs and idempotency keys grant no authority.

Owner reads traverse the Judgment journal and receipt ancestry; unowned historical records and global tapes/free attempts/scores/revenue remain operator-only. Production legacy receipt-bearing details and exports are closed. Older `/4663/me/*` handlers previously marked supplied wallet selectors as authenticated; production personal history, wallet proof/reputation views, profile HTML and OG images are now operator-only because there is no reviewed tenant-to-wallet binding. The wildcard HTML route checks the actual path. Ordinary catalog/market telemetry, issuer-key discovery and existing explicit published market-resolution/share projections are separate from private paid Judgment access; this change approves no new public paid-proof projection. [Route policy inventory](evidence/judgment-dx1/2026-10-12/route-policy.json) supports review of the documented routes; OpenAPI and runtime share the classifier.

Static operator credentials are a suitable closed-launch authority for the actual server deployment. Public credential issuance, automated rotation, tenant-to-wallet ownership, historical-owner backfill and a minimal public paid-proof projection are not invented. Their absence keeps the relevant endpoints closed. Large-scale history-query performance and least-privilege operator/database credential provisioning still need deployment review.

## Reconciliation and database recovery

The operator endpoint accepts a transaction hash as a candidate hint. A configured RPC independently verifies the actual chain, finalized canonical successful transaction, exact token transfer to the merchant, amount/payer, and the original EIP-3009 authorizer/nonce/time window. Compare-and-set permits one `settling → settled` transition, retains the original proof hash and rejects settlement-reference reuse. It never calls settle or publishes a receipt. Clients then recover through the original proof-bound paid POST. [Reconciliation runbook](judgment-dx1-reconciliation-runbook.md) includes the exact procedure and conservative failure handling.

RPC-only recovery cannot truthfully carry the existing `facilitator_attested` billing tag, so the optional tag is omitted while the payment reference/charge stay sealed. The verified witness is private journal data and a versioned non-authoritative projection. Automated economic recognition for those recovered receipts stays closed until a reviewed versioned billing-provenance profile exists. Existing historical receipts are unchanged.

The real PostgreSQL HTTP/SDK tests cover lost post-commit responses, fresh application/client/repository instances, pinned receipt signatures and concurrent reconciliation. A separate disposable PostgreSQL 16 exercise also issued one signed mock-paid receipt, dumped the database, physically restarted the PostgreSQL container, then restored the dump into a second database. Both recovery paths returned the byte-identical expired historical receipt, verified the issuer, rejected missing original proof and called settle/verify **zero additional times**. Receipt hash: `sha256:d784fbfa1c93b42e8488089c292f1b0454a55aa2277b1a48be29985cf004e078`. This is local recovery evidence, not a production backup drill.

## UI evidence

The Check panel has intent, route/provider/service subject, budget, risk, evidence, Judgment and inspectable proof. The key is ephemeral, Check requires it, and changing/prefilling fields sends no assessment. There is one explicit Check action. The UI has no configured wallet adapter: sufficient evidence displays a payment-authorization blocker and points to the authorized SDK flow. It does not silently initiate payment. Free insufficient evidence is labeled separately from a paid receipt, execution or independently verified outcome.

[Desktop screenshot](evidence/judgment-dx1/2026-10-12/ui-desktop.png), [mobile screenshot](evidence/judgment-dx1/2026-10-12/ui-mobile.png), and [browser assertions](evidence/judgment-dx1/2026-10-12/browser-qa.json) record Chrome 154, one explicit POST, zero automatic POSTs, no credentials in local storage, no horizontal overflow and no page errors. The actual socket-backed UI assessment was free; no wallet-funded UI settlement is claimed.

## Remaining release blockers

1. PR #7 integration and DX-1 security/reconciliation review are pending. Do not self-approve or promote a draft based on local passes.
2. Live staging is unqualified: deployed exact revision, durable database ledger/restore, fresh scoped evidence, trusted issuer rotation, managed tenant credentials, edge rate/body/time limits and alerts need operator qualification.
3. Live x402/token/facilitator/RPC compatibility and finality have not been exercised. Reconciliation conservatively leaves same-second millisecond quote ambiguities, unsupported authorization profiles, old records without original authorization binding and ambiguous batch transfers pending. Do not loosen them or resubmit payment to force recovery.
4. A versioned RPC billing-provenance profile is needed before automatically recognizing RPC-only recovered receipts as economic revenue.
5. Historical tenant ownership and wallet identity need reviewed mappings. A public minimal paid-proof projection needs explicit approval. The paid UI wallet authorization interaction remains unqualified.
6. Native AMD64 (if the eventual host uses it), image SBOM/OS scan, production load/edge abuse limits and the documented low dependency residual need release-policy disposition.
7. Independently reviewed real outcomes and Robinhood market policy qualification remain open. Service evidence cannot authorize token-market decisions; no autonomous execution is introduced.

The previous causal-audit context/acceptance/history safeguards remain covered by existing tests; mock classification does not close independent-outcome truth. This work closes the paid API's missing tenant boundary and supplies conservative reconciliation and one-call DX, but does not replace the separate staging successor's review or establish production evidence. Rollback must keep paid traffic disabled and private access closed; preserve journals, receipt bytes and issuer trust. No down migration is needed.

**Decision: GO for draft review and controlled development; HOLD for public paid launch.**
