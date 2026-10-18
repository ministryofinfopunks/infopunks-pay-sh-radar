# FIRST SPENDER R3 — Trust before scale

**HOLD. Review candidate only. Production provenance is not remediated by this package. Economic usefulness and willingness to pay remain NOT ESTABLISHED.** No source under `src/`, receipt reader, migration, payment/execution control, UI, deployment or existing qualification evidence is changed. No external data, provider or production population has been accessed. No live or simulated payment is required to reproduce R3.

This isolated draft is based on PR #17 at `d859c5dc13948f312c3652539704cea06d903cd3`. PR #16 at `d6b77e573f9939d4af70bdbd9416619001bf3cf9` is a distinct comparison baseline. Its later two-stage experiment is not incorporated into #17 or R3. Both exact trees, per-file SHA-256 manifests, original PR descriptions and qualification boundaries are preserved separately in `baselines/`. Pinning is an evidence freeze, not a GitHub branch lock or new qualification of either PR. If either remote head changes, stop and report drift; do not update the pin automatically.

Review order:

1. [Provenance contract](provenance-contract.md), its [versioned machine contract](live-evidence.contract.v1.json), offline [reference verifier](assurance.mjs), and [compatibility/migration inventory](compatibility-migration.md).
2. [External evaluation protocol](external-evaluation-protocol.md) and [offline intake/accounting tool](intake.mjs). There is **no external corpus**, trusted production registry, independent outcome, new held-out result or fee-value estimate in this submission.
3. [Independent approval register](approval-register.json). Every approval is pending/unassigned. Agent checks and GitHub CI cannot fill an independent review slot.
4. [Revised product decision](product-decision.md). Current recommendation: narrower provenance and cheap preflight tooling, with full Radar an unpriced research hypothesis.
5. [Validation record](validation.md), [exact-head verifier](source-manifest.mjs) and [baseline summaries](baselines/README.md).

Node **24.21.0**, no install or credentials required for R3's own checks:

```sh
node --test tools/first-spender-trust-r3/tests/*.test.mjs
node tools/first-spender-trust-r3/source-manifest.mjs .data/trust-r3/exact-head.json
```

Run the source verifier from a clean committed checkout. It verifies both baseline manifests against Git objects, rejects changes outside this directory and its exact offline workflow `.github/workflows/first-spender-trust-r3.yml`, verifies baseline trees and records the exact candidate head and every package/workflow file digest. Output uses exclusive creation. It does not rerun or inherit prior CI qualifications. Keep generated head manifests outside the source commit to avoid a self-referential commit hash. Independent approvals must bind that exact head plus contract, source and dataset hashes; any change invalidates approvals.

External intake commands are documented in the protocol. Missing identity grants, signatures or corpus blocks intake. Test-generated keys and fictional minor-unit rows exist only in memory for adversarial software checks; they are not provider observations or economic evidence.

The human requires independent review of actual source contracts, history and migration impact **before changing the reader**. Accordingly, this draft specifies the split and tests a detached reference contract. It installs no production trust roots or reader policy. A later separately reviewed implementation must enforce quarantine for new decisions; this package must never be represented as a deployed fix. HOLD includes no new spend authority, live payments, staging, deployment, merge, public proof publication or production change. Existing human visual approval gates remain required before any future merge.
