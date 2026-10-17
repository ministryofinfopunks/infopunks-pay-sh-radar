# Local engineering qualification — 2026-10-18

**HOLD. Simulation only. External purchases: 0.** Audited reference: 9a5a5b7658a3d85e0db20ecffcdd4246ed0f8bbc. Application, security, receipt, payment, migration, deployment and UI source files are unchanged by this package.

Retained `verification-report.json` records **1,020 cases, 17 distinct scenarios, 100 concurrent local tasks, 0 failed cases, 0 unauthorized executions, 0 duplicate simulated charges, 0 unreconciled submissions, 0 missing parent receipts**. All **480 completed executions** had their canonical receipt ancestry and judgment signature verified. Local evaluator outcomes: 420 confirmed, 60 contradicted. Bad deliverables were deliberately contradicted rather than trusted because a request succeeded.

Local case latency p50 **903.92 ms**, p95 **4,890.19 ms**, including SQLite writes, signing, receipt/evaluation checks, local scheduling and contention. This is not API latency or a production performance target. It is a single-host, 100-task synthetic run, with isolated per-case databases. Duplicate-request cases each race 100 execution calls on one capability. A separate unit test races 100 decisions against one shared budget and permits exactly one reservation/capability.

Validation on **Node v24.21.0**:

- 27 Spend Lab tests passed, including a terminated child-process restart after provider commit, no resubmission during reconciliation, conflicting decision replay, corrupt storage, buyer-output forgery, shared-budget concurrency, and receipt publication surviving a concurrent control transaction rollback.
- 57 existing protocol regressions passed across economic judgment, economic API, pre-spend SDK, pre-spend judgment integration and payment integration tests. These do not claim that the offline runner used x402.
- Repository TypeScript check and the dedicated Spend Lab TypeScript check passed.
- Source whitespace check passed. No new package dependency or lockfile change.

`verification-report.json` contains source content digests produced by the repository's canonical JSON hash function (the input is each file's UTF-8 string, not its raw bytes). The frozen audited reference binds reused upstream code. Three samples include full canonical receipt chains and disposable public issuer keys; they grant no external trust. Private signing keys and SQLite databases are excluded from commits and CI artifacts. The local full case evidence remains under `.data/spend-lab/retained-qualification` in the isolated worktree.

Limitations: 1,020 cases repeat a 17-scenario catalog 60 times; buyer roles and providers are deterministic simulations. The evaluator uses separate read-only provider evidence, under the same operator/OS identity; independent reviewer and credential isolation remain pending. External outcome accuracy, real-provider usefulness, actual judgment fees, infrastructure cost and counterfactual economic benefit are unknown/null. The full PostgreSQL, image, accessibility, device and deployment release gates were not rerun for this isolated tool and remain HOLD. No real-service or wallet access was performed.
