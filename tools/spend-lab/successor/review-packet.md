# Independent review packet / FIRST SPENDER successor

Status: **HOLD / external independent review PENDING**. Scope: reproducible local simulation engineering and paired task-oracle comparison. The packet supplies evidence for review; it is not itself an independent approval.

## Evidence map

| Review question | Implementation / reproducible evidence |
| --- | --- |
| Exact source and frozen preservation | `source-manifest.mjs`; both generated `source-manifest*.json`; pinned CI checkout; frozen Git tree digests |
| Canonical HTTP / 402 / private lineage | `http-worker.ts`, `http-client.ts`, existing `src/api/app.ts`, existing SDK and x402 gateway |
| No real payment or wallet | Worker sanitized environment, loopback-only transport, non-EVM proof, local-only nonce, simulated transaction namespace; facilitator rejects EVM-like proofs |
| Intent and execution authority | `controller.ts`; allowlist, single capability per task, bounded operation, distinct execution signature, durable submission claim |
| Restart and corruption | `http-storage.ts`; encrypted SDK store; SIGKILL test; durable provider response recovery; corruption negative tests |
| Simulation/live boundary | `src/security/evidenceProvenance.ts`; shared judge and frozen-context assessment; simulation gateway pairing and production refusal |
| Evaluator separation and signed lineage | `evaluator-worker.ts`, `evaluator.ts`; one-time public trust pin; child-private signing key; forged-signature, altered-output/lineage and repinning negatives |
| Blinded independent task labels | `oracle.ts`, `profiles.ts`, signed commitment/reveal, frozen decisions hash, raw audit outputs |
| Economic comparison and costs | `benchmark.ts`, generated `comparison-metrics.json`, per-task rows; negative result and null actual costs |
| Legacy regression | Existing 1,020-case/17-scenario lab, existing canonical SDK/payment/engine/context tests; regenerated in fresh output only |

## Reviewer procedure

1. Check the draft PR's exact SHA against the manifest, source-set hash, frozen tree digests and artifact name. Re-run from that exact clean checkout using Node 24.21.0. The old PR and production branches must remain untouched.
2. Inspect every shared-core change, especially default rejection of simulated evidence, simulation-only settlement references, gateway pairing, issuer namespaces and refusal under production. No caller-controlled HTTP field selects a simulation domain. Check both initial assessment and pre-execution revalidation.
3. Audit the process boundary and file permissions. Verify controller, judgment and evaluator keys differ. The worker's environment is allowlisted and contains no inherited payment, RPC or database configuration. A judgment receipt alone must fail the provider boundary.
4. Verify evaluator attestation signatures with the generated public key; verify the label commitment equals the hash of revealed labels, and the reveal binds the exact frozen decisions hash. Follow Observation → Judgment/context → signed capability → Execution → Evaluation and the evaluator's signed hash bindings in the **locally generated** lineage files. Public CI uploads intentionally exclude private keys, SDK proof sessions, databases and raw signed receipt archives.
5. Independently inspect the reference contracts (half-open intervals, p90 nearest rank, left join, repeated query values, Unicode codepoints, exact case-sensitive SHA-256). The oracle must not derive labels from Radar decisions, authored expected verdicts or repeated scenario counts. Replace same-author probes/specs with separately curated/provider-collected data before making economic claims.
6. Recompute row totals. Gross prevented losses minus missed gains minus extra judgment fees equals paired net difference here. Inspect false blocks, missed losses and negative-value correct outputs; do not report only prevented losses. Compare measured latency distributions and explicit unknown actual costs.

## Limits requiring separate work

- No genuinely live market/provider/payment/settlement evidence was produced. EIP-3009 signatures and chain finality were not exercised; wire compatibility uses simulated facilitator decisions.
- Labels are independently computed task correctness and local observed outcomes. Economic values, task mix and probes remain same-author local assumptions. External independent curation, credentials, ground truth and review are still absent.
- Blinding prevents the decision function from receiving labels before commitment/reveal; it does not prevent a source-code-reading operator from anticipating a deterministic fixture. This is not an adversarial secrecy or statistical generalization claim.
- Process credentials are distinct, but the shared OS user/workspace is not a hostile-controller security boundary. A separate administrator, immutable evidence intake and OS/service isolation are required for stronger claims.
- A provider crash after reservation and before durable output stays pending. The system does not invent completion or spend again. Journal hash chains detect edits/gaps within the surviving log, not malicious whole-database rollback; no external witness is configured.
- HTTP request rate limits remain in force. Disposable restarts between batches reset the local limiter while replaying the durable journal. No production limit is weakened.
- Original UI baselines, release qualification and evidence remain frozen. There is no new UI approval, staging approval, production qualification, independent economic validation, launch authorization or external proof publication approval.

## Release gates (all remain HOLD)

Staging; real purchases; wallet/remote payment access; public payments; production; external proof publication; merge; deployment. No automation in this successor opens these gates. A draft PR and CI results do not change them. Future merge additionally requires the repository's human visual approval.
