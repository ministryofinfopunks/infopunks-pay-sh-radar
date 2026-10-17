# FIRST SPENDER / localhost successor

**HOLD. LOCAL SIMULATION ONLY. Real economic usefulness is NOT ESTABLISHED.**

Successor to draft PR #15 at `7605310bce2b6d3adf193b9f97395c5251e0ad4f`. The original `tools/spend-lab/reports/`, `docs/evidence/` and tracked `docs/qualification/` trees are frozen. This work does not qualify staging, purchases, public payments, production, external proof publication, merge or deployment. Human visual approval remains required before any future merge. No UI is changed.

## Reproduce

Use Node **24.21.0** and a fresh checkout of the draft PR's exact head. No `.env`, wallet, RPC, payment account, database account or production credentials are needed.

```sh
npm ci
node tools/spend-lab/successor/source-manifest.mjs .data/first-spender/source-manifest.json
npx tsc --noEmit
npx tsc -p tools/spend-lab/tsconfig.json
npx vitest run tests/spend-lab-successor.test.ts tests/spend-lab.test.ts tests/economic-judgment-engine.test.ts tests/economic-engine-api.test.ts tests/judgment-dx-sdk.test.ts tests/pre-spend-sdk.test.ts tests/unit/judgment-service.test.ts tests/decision-context.test.ts tests/integration/pre-spend-judgment.test.ts tests/integration/pre-spend-payment.test.ts
npx tsx tools/spend-lab/successor/cli.ts .data/first-spender/comparison
npx tsx tools/spend-lab/cli.ts --cases 1020 --concurrency 100 --output .data/first-spender/legacy
node tools/spend-lab/successor/source-manifest.mjs .data/first-spender/source-manifest-after.json
```

The CLI refuses an existing output directory. Keep both source manifests beside the result. Set `FIRST_SPENDER_EXPECTED_SHA` to the full candidate SHA to enforce it; CI supplies this automatically and checks out the PR head, never the synthetic merge commit. The source manifest refuses dirty tracked source, untracked source files and changes to the frozen evidence trees. It records the commit, Git tree, runtime, lockfile and per-file SHA-256 digests. Generated outputs stay in ignored `.data/`; none replace frozen qualification evidence.

## Workstream A

`boundedIntentTool` exposes one allowlisted task ID. It cannot accept a URL, wallet, payment adapter, credential, arbitrary operation or policy. The controller uses `integrations/radar-sdk.ts` and the existing SDK against the actual Fastify `createApp` route `POST /v1/pre-spend/check` over numeric loopback HTTP. Private SDK session, receipt, context and issuer routes retain canonical tenant authentication. The local observer is a worker-only route with a separate local credential; it is not an agent tool.

A separate disposable HTTP facilitator exercises the official x402 challenge/verify/settle transport. It accepts only a deliberately **non-EVM** `SIMULATION_ONLY_NON_EVM_PROOF` with `local-only-*` nonces. Real-looking EVM signature bytes are rejected. It has no signer, wallet or RPC. Base/USDC token fields are required **wire-format metadata**, not chain activity. Settlement references are `simulation:x402/<digest>`; they cannot pass the default live service's transaction validation.

The SDK verifies receipt hashes, request binding, parent observations, frozen context replay and a pinned Ed25519 issuer. Its verified judgment still says `execution_authorized: false`. Only then can the separate controller issue an Ed25519 execution capability under a different issuer/signature domain. The local provider checks its exact operation, stored issuance, expiry, input hash, delegate, audience, recipient, asset and fees. A task may receive only one capability in a disposable controller database; each catalog task costs at most 50 toy units. A unique durable submission claim prevents concurrent duplicate execution. A completed delivery can be observed after restart without a new submission. An unresolved pre-commit crash remains pending and cannot be blindly retried.

The integration test loses a settled HTTP response, SIGKILLs the server, reopens its hash-chained SQLite event journal and encrypted SDK session, then resumes with the original proof and one payment. It separately closes/reopens the controller after a committed provider response is lost; provider output is reconciled without another charge. The inherited lab additionally retains its real child-process crash matrix. These are distinct tests, not claims that every crash window can automatically recover.

## Provenance and authority

The old simulator's `catalog_source: 'live'` bypassed an engine eligibility discriminator; `simulation: true` did not previously disqualify it. The active simulator now emits a strict `LocalSimulationProvenance` with `catalog_source: 'simulation'`, `external_economic_activity: false` and `spending_authority: 'none'`. Canonical simulation facts say `catalog_live: false`.

`LocalSimulationDomain` is a host-only branded, registered object. A JSON flag, request field or environment toggle cannot create one. Live readers reject simulated markers; simulation readers reject live evidence. Simulation storage requires a simulation gateway and a `spend-lab/*` judgment issuer, and production issuance refuses simulation domains. The economic engine additionally confines simulation to `lab:simulation/MOCK`, fixed local parties and `spend-lab/*` execution profiles/issuers. The production registration path never supplies a simulation domain. This is a guard against accidental authority crossover in trusted host code, not a sandbox against an operator editing the program.

The outcome evaluator has a separate child process, generated private Ed25519 key and attestation signature domain. Its private key is never returned to the controller. Only public judgment/execution trust is pinned once. The evaluator reads durable output and archived lineage, verifies the pinned signatures and ancestry, computes the outcome against its reference oracle, creates the canonical Evaluation receipt and signs its hash and complete lineage in an attestation. The controller cannot propose an authoritative outcome or sign evaluator attestations with its own key. Hash-chained HTTP storage and hashed provider records fail closed on detected corruption.

This remains **same-operator local process separation**, not independently administered credentials, OS-enforced filesystem isolation or external independent review. The local operator can access the workspace. The original lab's historical evaluator is not retroactively described as independently controlled.

## Workstream B

There are 20 unique tasks, families and provider implementations, once each: arithmetic, statistics, sorting, normalization, CSV, JSON, time, cryptography, Unicode, decimals, URL queries, intervals, text, unit conversion, relational joins, extraction, validation, availability, latency and quantiles. Correct outputs, malformed outputs, unavailable delivery, slow delivery and negative-value delivery occur. Replaying a scenario does not increase this diversity count.

Before decisions, every actual local provider is audited. The separate evaluator receives specifications and audit output files, **no Radar verdicts or probe fields**. Its independent `oracle.ts` implements the reference contracts and derives correctness, deadline, net-unit and should-spend labels. It signs a commitment to labels/specifications before the controller decides. Decisions are frozen and hashed before labels are revealed. The oracle does not import Radar or the provider implementation. Provider probes are separately declared imperfect evidence, not oracle-derived success labels; false blocks and missed losses remain visible.

Both arms use the same offer/budget rule, tasks, provider code, price, fees and value specification. The treatment adds only the canonical Radar gate. Each arm's executed deliveries are measured separately. Baseline executions are in-process disposable local calls; treatment executions cross the signed local capability boundary. Timings include this treatment overhead, so the report does not isolate pure judgment latency from every controller/verification cost. No model or external paid provider is used.

`comparison-metrics.json` contains per-task paired net outcomes, labels, decisions, correct abstentions, prevented losses, false blocks, missed gains, provider prices/fees, judgment fees, and measured latency totals/mean/p50/p95. Raw canonical lineage and signed evaluator attestations remain in local `lineage.json` and task archives. Audit/setup cost is separately disclosed. Actual monetary, CPU monetary and inference costs are unmeasured/null; toy units are not currency.

The observed deterministic comparison is baseline **101**, Radar **68**, difference **−33 toy units**: **46** prevented losses, **62** missed gains, **17** judgment-fee units, **6** correct abstentions and **3** false blocks. Latency varies by host. This negative result is preserved, not tuned away. The fee mapping (one toy unit per paid judgment), utility values and profile selection are authored local assumptions. Independent task-correctness labels are not independent market valuations, a representative provider population, an independently collected economic dataset or evidence of real economic usefulness.

See [review-packet.md](review-packet.md) for the independent reviewer handoff and remaining gates.
