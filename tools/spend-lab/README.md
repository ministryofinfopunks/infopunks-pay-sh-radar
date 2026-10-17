# INFOPUNKS / FIRST SPENDER

**The localhost successor and blinded comparison are documented in [successor/README.md](successor/README.md), with an [independent-review packet](successor/review-packet.md). Frozen reports below describe PR #15 at `7605310bce2b6d3adf193b9f97395c5251e0ad4f`; they are not updated or reinterpreted as successor evidence.**

Legacy local simulation of economic intent → Radar judgment → separate execution capability → provider delivery → outcome evaluation. **HOLD: staging, live payments and production remain unauthorized.** No real purchase has occurred. The legacy runner adds no endpoint, deployment, wallet integration or public proof card.

Run from the repository root after installing its locked dependencies:

```sh
npx tsc -p tools/spend-lab/tsconfig.json
npx vitest run tests/spend-lab.test.ts
npx tsx tools/spend-lab/cli.ts --cases 1020 --concurrency 100 --output .data/spend-lab/my-run
```

Use a fresh output directory. The CLI refuses to overwrite a run, permits at most 10,000 cases and 100 concurrent tasks, exits nonzero on acceptance violations, and writes a machine-readable `verification-report.json` plus each case's canonical receipts. SQLite databases stay private under the ignored `.data` directory. Node's built-in SQLite is used; no new dependency is introduced. See reports for the actual tested runtime, scope and limitations.

## Five roles, one controller

Four deterministic buyer roles propose typed task manifests through `request_radar_judgment`: Research Buyer, Tool Buyer, Risk Scout and Reliability Tester. The fifth role, Outcome Evaluator, opens the provider evidence database read-only and checks the actual stored output, settlement record and deliverable hash. The buyer tool has no executor or signing handle. These are deterministic runtime roles, not deployed LLM agents. No OpenAI calls occur.

The controller reuses Radar's economic judgment engine, Ed25519 judgment issuer, separately keyed execution issuer, execution gate, reservations, canonical receipt authority and evaluation service. Every executable state is canonical: `proceed`, `test_spend_first`, `do_not_spend`, `insufficient_evidence`. There is no paid chain for insufficient evidence. Simulated judgments are zero-fee; this loop does not claim to qualify the paid x402 HTTP workflow. Existing x402/SDK regression tests are reported separately.

`integrations/radar-sdk.ts` now connects the successor's bounded intent tool to the canonical SDK using a disposable localhost lab and its non-EVM simulated payment adapter. It is not wired into this legacy offline runner. A paid judgment never grants execution authority. No model or managed coding-agent harness is a payment executor.

## Evidence meaning and isolation

All simulated operations use `lab:simulation/MOCK`, `spend-lab/mock-service-v1`, lab-only recipients and a lab-only issuer. They cannot represent Base, Solana or Robinhood settlement. Every case/report has `simulation: true`, `external_purchases: 0` and HOLD. Raw canonical receipts are enclosed by that simulation record; never publish them as economic proof.

PR #15's simulator used `catalog_source: live` alongside simulation markers to satisfy an active-source eligibility discriminator. That historical modeling ambiguity is preserved in the frozen reports for audit. The active simulator now uses strict `catalog_source: simulation` provenance and a branded local-only evidence domain. Default live eligibility rejects simulation markers; the simulation domain cannot qualify real spending operations. See the successor's provenance and authority description for the shared-core guard and its limits.

The control database contains disposable signing keys and state; the separate provider database contains deliveries and no keys. Files are mode 0600; new run directories are 0700. The evaluator opens only provider evidence and has no write handle. These are code-level separations under one local OS user, not a credential/OS security sandbox. An arbitrary malicious script under that same user can read lab files. A real pilot needs a separately operated evaluator identity, service account and access policy. Internal evidence is not independent market demand or release approval.

## Scenarios and durability

`scenarios/catalog.json` fixes expected decisions, executions and outcomes across 17 scenarios. Cases vary by task ID and buyer role; 1,020 cases are 60 repetitions of this catalog, not 1,020 distinct economic situations. The 100-task run uses isolated case databases; a separate test races 100 callers against one shared budget. Duplicate-request cases race 100 executions of one capability. This is local interleaving and ledger contention, not distributed fleet throughput.

SQLite FULL synchronous transactions preserve reservations, capabilities and provider settlements; the provider commits its durable idempotency record before returning. A lost response leaves submission pending. Reconciliation reads the provider record without executing again, including after capability expiry. Receipt replay validates hashes, ancestry and issuer signatures on restart. Partial receipt publication resumes using the canonical idempotent services. A process-death test exits the controller after a provider commit and restarts from disk.

Only one controller may open a case: an exclusive `.controller.lock` prevents concurrent processes with inconsistent receipt caches. A crash intentionally leaves the lock. An operator must verify the recorded process has exited before removing it; never remove an active or ambiguous lock. Keys stay inside the private control database and never appear in reports or commits. This is a disposable lab database, not a production database replacement.

## Recovery and review

1. Preserve the complete case directory, control DB, provider DB and report. Never create a replacement payment after ambiguous execution.
2. Confirm the controller PID is dead before removing its stale lock. Reopen the same case via `openLab`; inspect the durable attempt and call `gate.reconcile(authorization_id)`. Do not call the provider directly.
3. If submission has no delivery evidence, retain pending/unverified status and escalate. No fabricated Execution/Evaluation receipt or automatic refund.
4. If database integrity, receipt ancestry or signing trust fails, stop that case and retain the artifacts. Rebuild a disposable run rather than editing the evidence.
5. Review `reports/audit.md` and `reports/release-gates.md`. Any source, adapter, schema or policy change invalidates affected qualification evidence.

No release approval, merge, deployment, visual approval, real-provider access or real-money authority is implied by these commands.
