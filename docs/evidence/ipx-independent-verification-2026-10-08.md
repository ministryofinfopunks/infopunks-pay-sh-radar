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

## Independent frozen-candidate check: `d9065dc` (superseded)

The detached candidate checkout at `/Users/ahdilm/.codex/worktrees/ipx-frozen-verification` had exact HEAD `d9065dc1682a22fc73c87b0d2a63bc4f0229e235`. The source tree stayed clean. Checks below were run against that SHA alone. A later code fix will require a new candidate SHA and new applicable checks; none of these results transfer automatically.

| Check | Independent result |
| --- | --- |
| Dependency install | `npm ci --ignore-scripts`: exit 0 from committed lockfile; 181 packages added. |
| Full application suite | With `CANONICAL_RECEIPT_TEST_URL` and `ECONOMIC_ENGINE_TEST_URL` pointing to disposable PostgreSQL 14.20 on localhost:55478, `npm test`: exit 0; 268 files, 1,895 tests passed, one skipped. |
| Skipped harness | The full-suite skip was the real backend termination case gated by `POSTGRES_RESILIENCE_TEST_URL`. Running `POSTGRES_RESILIENCE_TEST_URL=postgresql://ahdilm@127.0.0.1:55478/postgres npx vitest run tests/postgres-resilience-failure-matrix.test.ts` separately: exit 0; 16 tests passed, zero skipped. |
| Static/build | `npm run typecheck` and `npm run build`: both exit 0. Build reports an existing large client chunk warning. |
| Migrations | All 21 ordered `.up.sql` files applied to a fresh private schema on PostgreSQL 14.20; resulting schema had 46 tables. The schema was dropped afterward. This proves local migration ordering only. |
| Solidity | `forge test` from `contracts`: six tests passed, no failures/skips, Solidity 0.8.30. OpenZeppelin source was copied byte-for-byte from the existing ignored local install after the pinned remote clone failed; this run does not independently attest the remote dependency commit. |
| Dependency security | The lockfile audit reports 11 affected packages: 8 high, 2 moderate, one low, including direct runtime `fastify`. Findings require triage and reviewed disposition before independent security approval. |

### Release finding V1: an accepted-boundary manifest is not stable

`src/services/causalTapeService.ts:49–67` filters sequenced receipts to `acceptedThrough`, but adds **all** free attempts and quarantined receipts to the same manifest without a boundary. It also includes later `historical_unsequenced` rows. An independent probe using the real service with an empty receipt store requested `acceptedThrough: 0` twice. Adding one free attempt between reads changed `manifest_hash` from `sha256:29f5d530cacc5cb0902787aab1776a19a34dacb75f71cb0519cb7cbf9afd327c` to `sha256:0ac6061289c92363996aa8e49bae0283ad6c7e3e394f2d476709fd27e0b131fa`. The frozen accepted boundary did not change. Probe source: `/tmp/ipx-d906-manifest-probe.ts` (ephemeral, outside the repository).

This defeats historical manifest reconstruction and cursor consistency as currently claimed by A6. A shared sequence/snapshot cutoff for attempts and quarantine, or a separately versioned publication boundary, must make the same historical manifest reproducible after later writes. Retest both later free attempts and later quarantines, plus unsequenced history, at the repaired SHA.

### Provisional gate matrix at `d9065dc`

| Gate | Verdict | Evidence / missing dependency |
| --- | --- | --- |
| G0 | BLOCKED | Local signed-response JSON classifier and causal witness exist, but no real independently finalized route, actual task output, reviewed signer registry or genuine O/J/X/E/J revision was supplied. Synthetic fixtures count zero. |
| G1 | FAIL | The accepted-boundary manifest changes after a later free attempt. Public immutable publication/mirror and failed-outcome coverage are also unproven. |
| G2 | BLOCKED | D1 records an unapproved model choice; no signed economic policy and reviewed full terms. D2 conservation scenarios are local simulations. |
| G3 | BLOCKED | Canonical deployed instrument, bytecode/constructor and funded bidirectional venue proof are absent. |
| G4 | BLOCKED | No independent security or legal opinions or resolution log. Dependency audit findings await triage. |
| G5 | BLOCKED | Local migration/restart tests pass; no same-SHA production deployment identity, production migration, backup/restore and health evidence. Earlier public snapshot reported 503. |
| G6 | BLOCKED | Required gates do not all pass on one code SHA, policy and deployment; G1 also fails at this candidate. No economic activation authorization was inferred. |

The `d9065dc` candidate was superseded for repair of V1. The final matrix must be recomputed on the next frozen SHA.
