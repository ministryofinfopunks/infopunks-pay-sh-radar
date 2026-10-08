# IPX causal intelligence loop — code audit

Date: 8 October 2026. Scope: the current working tree, including pre-existing uncommitted implementation. Base Git revision: `55f05d6f6ac46603072662c91cb02d09ba879870`. This is an implementation and proof-readiness audit, not a production attestation or financial-contract security audit. Concurrent working-tree changes were observed during validation; checks below describe their tested state, not one frozen release. The delivery manifest records source hashes for comparison.

## Verdict

**The deterministic feedback mechanism exists. The independently verifiable real-route proof target is not established.**

The paid pre-spend service can change `proceed` to `do_not_spend` after a contradicted evaluation. Its current rule is a zero-baseline, unbounded sum of evaluation deltas: confirmed `+5`, weakened `−2`, contradicted `−15`; a score `<= −10` vetoes an otherwise evidence-qualified decision. Positive history never supplies missing current evidence.

Local reproduction confirms this behavior. It also confirms that unverified internal execution receipts contribute to that score, and future-dated internal evaluations can affect an earlier judgment. The next judgment does not commit the history used to make it. No complete production route, live artifact set, finalized external execution, or exported causal revision witness was verified in this audit.

**Launch gate: HOLD.** Local arithmetic and ancestry validation are useful evidence of implementation; they cannot be advertised as demonstrated production learning or improved judgment.

Related deliverables: [Receipt Tape v1](receipt-tape-v1.md), [IPX/PLTR Economic Mechanism Specification v1](ipx-pltr-economic-mechanism-v1.md).

## What the code already supports

| Requirement | Current implementation | Assessment |
| --- | --- | --- |
| Four typed receipts | `src/schemas/receipts/` | Present; strict schemas and canonical hashes |
| O → J → X → E ancestry | `receiptAuthorityService.ts`, migration 011 | IDs, parent hashes, scope and chronology checks; PostgreSQL foreign keys and immutable triggers |
| Authoritative pre-spend integration | `judgmentService.ts`, `app.ts:4472` | Paid canonical service behind `/v1/pre-spend/check` |
| Missing evidence remains free | `judgmentService.ts:87–125` | Returns `insufficient_evidence`, zero cost, no payment requirement |
| Execution-proof intake | `executionProofService.ts`, `settlementProofVerifier.ts` | Base USDC and RH USDG profiles; payload signature and finalized transfer verification |
| Evaluation-only score deltas | `evaluationService.ts`, `evaluationScorePolicy.ts`, migration 014 | Caller-authored deltas rejected; canonical policy creates delta |
| Score influences later decision | `judgmentService.ts:108–113` | Deterministic negative-history veto |
| Exact retry and restart behavior | Request journal, execution uniqueness indexes, PostgreSQL tests | Local targeted durability checks passed |
| Public receipt reads | `/v1/receipt-spine/:kind/:id`, `/v1/score/:subject`, `/v1/attribution` | Building blocks exist; discovery, frozen causal history and complete tape are missing |
| Native IPX economic artifacts | `contracts/`, `ipxRevenueLedger.ts`, launch routes | Undeployed implementation artifacts; different economics from the proposed trading-fee reserve |

## Findings, ordered by proof impact

### F1 — High: the next judgment omits its causal evaluation dependencies

Evidence: `src/services/judgmentService.ts:108–130`, `src/services/judgmentService.ts:28–48`, `src/schemas/receipts/judgmentReceipt.ts:5–27`.

The service reads `scores.project(...)`, but persists only decision, confidence, text reasons, observation IDs, payment data and times. Neither the response journal nor the sealed judgment records the contributing evaluation IDs/hashes, projection hash, score, veto threshold, decision-engine identity or frozen legacy inputs. Its parent pointers reference observations only.

Consequently, a verifier can replay the O → J → X → E ancestry but cannot reconstruct exactly which history was consumed by J2. The current receipt-policy version identifies ancestry validation, not the complete decision algorithm. Later evaluations and changed code can alter a retrospective explanation. Hashing J2 proves its bytes, not its derivation.

Required remediation: freeze the decision input/history snapshot when the quote is first assessed; persist it before any payment side effect; have a newly versioned judgment commit a decision-context hash. Export the full context and a signed revision witness binding J1, E, J2 and the replay artifact. Do not rewrite historical v1 hashes. Acceptance: an offline verifier reproduces J2 from frozen inputs and produces a different verdict when only the designated E is removed.

### F2 — High: unverified internal execution receipts can create score authority

Evidence: `src/api/app.ts:4550–4576`, `src/services/receiptAuthorityService.ts:43–61`, `src/services/evaluationService.ts:24–34`, `src/services/derivedScoreService.ts:29–38`, `src/persistence/canonicalReceiptStore.ts:47–55`.

The authenticated `/internal/receipt-spine/execution` writer calls `appendExecution` directly. `verification` and payload signatures are optional in the receipt schema. Authority validation enforces ancestry/window and, when present, consistency of declared verification fields; it does not require externally verified settlement for all execution receipts. Evaluations of these receipts are included in the same projection as proof-service executions.

The audit probe reused one unverified settlement reference under one judgment across 20 distinct execution IDs and obtained a score of `100`. Partial uniqueness guards apply to executions carrying verification metadata; they do not make the unverified path eligible evidence. This is an internal/admin trust-boundary gap, not an unauthenticated public exploit.

Required remediation: a trusted intake-path identity and replayable proof profile must determine score eligibility. Isolate historical/internal/synthetic receipts in a non-economic namespace. Do not infer verification from submitted JSON. Prevent settlement/task reuse across all eligible intake paths. For the separate economic executor path, verify capability, adapter outcome and evidence rather than requiring the external EVM profile indiscriminately. Acceptance: identical internal examples remain inspectable but cannot affect qualifying scores or production-loop counts.

### F3 — High: deterministic weights do not establish deterministic outcome classification

Evidence: `src/services/evaluationService.ts:49–70`, `src/schemas/evaluate.ts`, `src/services/economicPrecedentService.ts:evaluateExecution`.

The authenticated evaluation API accepts an outcome label and evidence reference strings. It checks parent authority and evaluator identity, then maps the label to a delta. It does not retrieve evidence, verify artifact content, apply a task rubric, or derive `confirmed`/`weakened`/`contradicted` from the result. An admin may supply the classification. Unsupported external evaluator signatures correctly fail closed.

The separate economic precedent service offers a `verifyTaskOutcome` callback, but the registered engine routes do not expose or wire a production evaluation worker using it. Calling something `independently_verified_execution_outcome` in a reason string is not independent evidence.

Required remediation: a versioned, task-specific evaluation procedure, artifact hashes and availability, authenticated reviewer provenance, documented conflicts and replay inputs. Human-reviewed outcomes may qualify if transparently labeled and independently reviewable; do not claim permissionless or fully automated truth. Acceptance: a reviewer can independently reproduce or challenge the outcome before the deterministic score rule is applied.

### F4 — High: evaluation history is not frozen at the judgment's knowledge boundary

Evidence: `src/services/evaluationService.ts:45–47`, `src/services/receiptAuthorityService.ts:73`, `src/services/derivedScoreService.ts:10–26`.

The internal evaluation creator accepts `evaluated_at`; ancestry only requires it to follow execution. The projection has no `as_of` filter or accepted-ingestion boundary. The audit reproduced an evaluation dated 1 January 2027 changing a judgment assessed on 7 October 2026. Backdated, later-ingested receipts create the complementary replay problem.

Required remediation: validate issuer time against a trusted clock and record server acceptance sequence/time. Select history using the committed snapshot boundary, not event time alone. Append late evidence without making it part of prior knowledge. Freeze quote-time inputs across settlement retries. Acceptance: future evidence is rejected/quarantined and late evidence cannot alter historical decision replay.

### F5 — High: the newer economic decision engine does not consume evaluation history

Evidence: `src/services/economicJudgmentEngine.ts:decide`, `src/services/judge.ts:judgeEconomicDecision`, `src/api/economicEngineRoutes.ts`.

The separate engine derives its deterministic result from job/policy, observations and a witness; it does not call the derived-score service or commit evaluated performance memory. It can emit canonical judgments and capabilities, but the paid pre-spend feedback test does not prove this path learns from evaluations. The default engine is disabled; when enabled it defaults to shadow mode and has no production executors registered by default.

Required remediation: choose the first proof route explicitly. Either certify the paid pre-spend path alone and label that scope, or integrate verified performance history into the economic engine before making a broader closed-loop claim. An external adapter could materialize new reviewed facts, but that feedback bridge must itself be evidenced and tested.

### F6 — Medium: retries intentionally preserve decisions, and the default key can mask the next judgment

Evidence: `src/services/judgmentService.ts:74–79`, `src/repositories/judgmentRequestRepository.ts`.

The default request key is derived from the request hash. Repeating an identical request without a fresh explicit idempotency key returns the completed prior judgment rather than assessing new history. This is correct retry semantics, but unsuitable for a demonstration claiming that an ordinary identical retry learned from E.

Required remediation: distinguish retry from reassessment in SDK/protocol documentation; use a new explicit key for J2 while preserving the same semantic task, and commit that distinction in the witness. Acceptance: same-key retries return the same receipt; fresh assessment IDs incorporate newly eligible E deterministically.

### F7 — Medium: public reporting cannot yet distinguish complete learning from ancestry

Evidence: `src/services/receiptAttributionService.ts`, `src/api/app.ts:4596–4617`, `src/schemas/receipts/judgmentReceipt.ts`.

Attribution reports observed executions/evaluations and outcome counts. It does not discover verified revision edges, export frozen decision inputs, or exclude every unverified internal execution from qualifying metrics. `/v1/receipts` is the legacy intake ledger, not the canonical four-receipt tape. Insufficient-evidence responses return with `receipt: null`; the canonical judgment schema requires at least one cited observation, so empty-evidence abstentions need their own public assessment record rather than invented receipt ancestry.

Required remediation: implement the attached tape contract with explicit namespace/eligibility, discovery and cursor coverage, immutable publication manifests and separate assessment-attempt visibility. Closed loop, causal revision and measured improvement must be separate metrics.

### F8 — Medium: validation occurred while other working-tree changes were in progress

The first `npm run typecheck` reported two TS2322 errors at `tests/ipx-revenue-ledger.test.ts:32` and `:33` concerning event-topic tuple types. A later run no longer reported those errors, but failed with TS7016 at `tests/ipx-economy-dashboard.test.ts:2`: missing declarations for `jsdom`. A final follow-up passed after that test changed again. The test changes are outside this audit's edits. No application or existing test source was changed by this review. These passing checks were not all run against one frozen release; controlled release validation remains necessary.

## Local evidence and reproduction

Run `npx tsx scripts/audit-ipx-causal-loop.ts` from the repository root. The script makes no network calls and spends no funds. It uses synthetic artifacts, mocked payment verification/settlement, unsigned judgments and the memory adapter. Its observation fixtures mimic the current reviewed-facts input contract; the exported bundle is explicitly classified synthetic and contributes **zero qualifying public loops**.

Outputs:

- `output/ipx-strategic-review/causal-loop-fixture.json`: O, J1, X, E, J2, before/after projection and fixed-input counterfactual.
- `output/ipx-strategic-review/audit-probes.json`: reproduced score contamination, duplicate unverified settlement inflation and future-evaluation behavior.
- `output/ipx-strategic-review/typecheck.log`: final passing follow-up; earlier diagnostics are recorded above.
- `output/ipx-strategic-review/contracts-tests.log`: local contract test results.

The fixed-time counterfactual uses identical request, reviewed facts and legacy response, with separate assessment keys. Without E: `proceed`; with E: score `−15`, `do_not_spend`. This establishes the local dependency in controlled execution. It does not turn the missing persisted dependency into a production receipt edge.

Validation performed:

| Check | Result | Limits |
| --- | --- | --- |
| Initial targeted receipt, feedback, evaluation, score, execution and economic tests | 80 passed; 6 skipped across 16 files | Database-dependent cases initially had no configured URL |
| Separate disposable PostgreSQL run | 9 passed across 8 files, zero skips | Canonical projection, execution, migration, payment, signing, RH accounting, engine durability and IPX provenance; synthetic rail evidence |
| Local causal audit script | Passed all assertions | Reproduces unresolved findings; not a live proof |
| Solidity contract suite | 6 passed, zero failures/skips | Unit/fixture tests, not independent security review or venue verification |
| Type checking | Final follow-up passed after two earlier failures | Working tree changed between runs; final log retained |

The disposable PostgreSQL instance was created for this audit, used only for isolated test schemas, then stopped and its generated database files removed. No production schema migration or deployment was performed. Production uptime, migrations, signer custody, live facilitator support, actual execution artifacts and public receipt completeness remain unverified. `output/ipx-strategic-review/review-evidence.json` records scope, checks and delivery source hashes; it is an audit manifest, not a signed production publication commitment.

## Exact proof sequence to close the gate

1. Fix F1–F4 for the chosen route, including snapshot binding, eligible proof authority and evaluation rubric. Clarify F5 scope and F6 reassessment semantics. Validate the release against a frozen checkout.
2. Select one real, bounded task and executor. Publish the exact rail/profile, limits, finalized settlement policy, evidence sources, rule version and signer registry. A deliberately bounded reproducible task failure may demonstrate learning; do not manufacture a false outcome label.
3. Capture O1 and issue J1 through the authoritative service. Distinguish the judgment fee from the task settlement.
4. Let the separate executor perform the task, and ingest X through its verified proof boundary. Retrieve and hash the actual output.
5. Apply the disclosed evaluation rubric; append E with source artifacts and reviewer/worker provenance. Include an unfavorable outcome if that is what occurred.
6. Assess J2 under a fresh key. Freeze current O2 (or explicitly record reuse of still-fresh O1), history and decision inputs. Require an actual decision-category change attributable to E; a changed reason string is insufficient.
7. Export a revision witness and replay twice at the same input/time boundary: all eligible history versus the same history with only the designated E omitted. Record both results and unrelated input changes.
8. Restart the service, export from PostgreSQL and independently replay the published bundle. Confirm no duplicate settlement/evaluation contributions and no synthetic receipt inclusion.
9. Publish the entire tape segment and coverage, including failed/unproven attempts. Label the demonstrated result “verified causal revision”; report improvement as unmeasured until independently established.

## Economic consistency note

The current IPX v2 artifact implements a reviewed portion of positive **USDG service contribution** routed through PLTR to purchase and burn IPX. It does not implement a buy-side PLTR reserve, sell-side IPX trading levy, or permanent lock. `IPX.sol` has no transfer tax. These are distinct candidate economic models, not two descriptions of the same deployed mechanism. The attached economic specification preserves both statuses and prevents additive funding or misleading reserve claims.
