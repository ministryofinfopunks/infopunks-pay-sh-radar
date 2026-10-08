# IPX independent verification — 8 October 2026

## Evidence boundary

This review uses an isolated checkout of `c56ca7e60efafb68a792223a173c2840cd274c50` on `codex/ipx-verification-gates`. Its findings are independent of package authors' test reports. The checkout was clean before validation. No production writes, transfers, signing, or deployment were performed. A frozen integration SHA, exact policy and deployment identity must be recorded before any G0–G6 PASS determination.

## Reconciliation of prior packages

| Package | Repository finding | Independent assessment |
| --- | --- | --- |
| A1 | The 134 SHA-256 entries in `ipx-baseline-2026-10-08.manifest.json` all match their corresponding blobs in capture commit `cdd2500`. | Baseline capture is reproducible. The earlier dirty-tree state and original test run cannot be inferred from the commit. |
| A2 | `1c06aa2` is an ancestor of `c56ca7e`; it adds decision context schema, persistence, v2 receipt linkage, replay CLI and tests. | Implementation is present. The reported suite and disposable PostgreSQL evidence are package reports until rerun against the frozen candidate. |
| A3 | `745c98c` is an ancestor of `c56ca7e`; it adds score eligibility checks, proof-gateway marker and migration 019. | Implementation is present. The execution ledger's “Pending commit” entry is stale. Its projection guard does not verify task outcome truth. |
| B identity | `d03bf51` is an ancestor of `c56ca7e`; it hardens identity conflict handling. | Code presence verified; full B1–B4 invariant scope remains to be assessed on the integrated candidate. |
| Receipt regression | `c56ca7e` changes one receipt-spine test to align with the new eligibility policy. | This is test alignment, not release evidence by itself. |

The prior A2 report explicitly states that its full suite ran before later type-only fixture edits; its final static/build checks covered those edits. This is appropriate package evidence but not one-revision release evidence. The A3 report names a disposable local PostgreSQL run, which is not production durability. The public read snapshot in `ipx-production-read-2026-10-08.json` recorded HTTP 503 for every checked endpoint at capture time and does not establish current deployment health.

Independent focused check at `c56ca7e`: `npx vitest run tests/decision-context.test.ts tests/execution-score-eligibility.test.ts tests/receipt-spine.test.ts tests/unit/derived-score-service.test.ts tests/integration/evaluate.test.ts` exited 0 with 5 files passed, 12 tests passed and 6 skipped. PostgreSQL-dependent tests were skipped because no test URL was supplied. The run supports local logic only.

`npm ci --ignore-scripts` completed from the committed lockfile. An independent `npm audit --json` reported 11 affected packages: 8 high, 2 moderate and 1 low. The direct runtime dependency `fastify` is among the high findings. The direct build/test dependencies `vite` and `vitest` also have findings. Audit count is a triage input, not proof of exploitability. A reviewed patch or explicit disposition is needed before G4 can PASS; do not upgrade dependencies outside the frozen candidate and then reuse old test evidence.

## Release dependency register

| Dependency | Required evidence | Current disposition |
| --- | --- | --- |
| A4 | Versioned rubric classifies pinned, retrievable task-output artifacts; no bare administrative outcome authoring. | Pending integrated implementation and adversarial validation. |
| A5 | Server acceptance sequence/time, future-time quarantine, committed history boundary, same-key retry/fresh-key reassessment. | Pending integrated implementation and PostgreSQL concurrency/restart validation. |
| A6 | Complete public O/J/X/E tape and manifests; free insufficiency attempts; signed causal witness with offline fixed-input counterfactual; synthetic exclusion. | Pending integrated implementation and public package validation. |
| B1–B4 | Protocol authority, version compatibility, identity uniqueness, receipt/payment/settlement invariants and adversarial replay. | Separate protocol branch under development; B3/B4 explicitly included. |
| C1–C6 | Read-only parity, deployment inventory, approved migrations, runtime operations, rollback and recovery, production proof. | C6 explicitly included; production-dependent steps require identified deployment/access. |
| D1–D5 | Explicit model and parameter choice, conservation simulation, policy approval, conditional contract/economic activation, independent economic review. | D5 explicitly included; choice/approval and live economic activation remain external decisions. |
| G0–G1 | One real eligible causal revision and complete public proof, both replayed independently. | Synthetic local examples count zero. |
| G2–G5 | Approved economics; canonical assets/venue; independent security/legal review; same-SHA production operation and durability. | Cannot be inferred from repository tests. |
| G6 | G0–G5 PASS on one code SHA, one approved policy and one deployment, with accountable release authorization. | BLOCKED until prerequisites are evidenced. |

## Gate decision rule

A gate can PASS only when its evidence binds the exact frozen source SHA, policy hash where applicable, and identified deployment. A local test PASS is a local implementation result. It does not convert a real-world gate to PASS. A failing required check makes the relevant gate FAIL; absent external approval or deployment proof makes only that dependent gate BLOCKED. G6 is BLOCKED unless every prerequisite is PASS on the same tuple.

## Frozen-candidate verification

Pending an integration SHA. Record exact commands, exit codes, skips, PostgreSQL version/port/schema scope, migration path, Foundry result, npm dependency audit, manifest hashes and counterfactual replay here after the candidate is frozen. Do not combine earlier package runs with candidate checks.
