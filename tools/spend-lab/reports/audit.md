# P0 capability and gap audit

Audited frozen local candidate: **9a5a5b7658a3d85e0db20ecffcdd4246ed0f8bbc**, tree **bb5114dfdd913639740a57e0860828983772355d**, existing local `codex/radar-r2-release-boundary`. This is the latest frozen candidate identified in the workspace R3 assurance report, not a claim that its independent approvals passed. PR #11 was read directly on 2026-10-18: OPEN/DRAFT, head **2c2fe64db173c63048e70353ae926aa199792d1b**, base `codex/track-a-release-candidate`.

The local frozen candidate is newer than PR #11 and includes release-boundary/UI qualification work. To keep the Spend Lab review diff confined to this task, its draft PR targets a separate immutable snapshot branch at the frozen SHA. It does not retarget or update PR #11. Repository application files remain unchanged. Untracked qualification files in the user's original checkout were read as reference only and are not incorporated.

| Boundary | Audited source | Reused / limitation |
|---|---|---|
| Tenant SDK and x402 | `src/sdk/judgmentClient.ts`, `judgmentIntegrity.ts` | Existing SDK exposed through loopback-only seam; HTTP/x402 are regression-tested separately, not part of offline case counts |
| Canonical decision | `src/services/judge.ts`, `economicJudgmentEngine.ts` | Existing deterministic evidence gates and canonical decisions; simulator uses a deterministic local candidate selection |
| Spending authority | `src/security/executionAuthorization.ts`, `src/services/economicExecutionGate.ts` | Ed25519 capability, exact operation, issuer, delegate, audience, expiry, policy, replay and reservation binding |
| Aggregate limits | `economicJudgmentEngine.ts`, `src/persistence/economicEngineStore.ts` | Existing atomic reservation logic and transition rules; new disposable SQLite adapter; 100 shared-budget contenders tested |
| Provider delivery | `EconomicExecutor` in `economicJudgmentEngine.ts` | New local-only provider with durable capability-keyed idempotency; no external provider or settlement adapter |
| Four receipts | `src/schemas/receipts/`, `receiptAuthorityService.ts`, `receiptIntegrityService.ts` | Existing authority, schemas, hash ancestry and signing; synthetic only, no external-proof eligibility |
| Reconciliation | `economicExecutionGate.ts` | Durable submission, response-loss recovery and provider query; no blind re-execution |
| Evaluation | `economicPrecedentService.ts`, `evaluationService.ts`, `evaluationScorePolicy.ts` | Independently reads provider DB/output; internal evaluator provenance retained; no independent operator credentials |
| Persistence | `canonicalReceiptStore.ts`, `economicEngineStore.ts` | Memory canonical authority replays a private SQLite journal; control records use original transition validation; no migrations or application DB writes |
| External proof | `src/services/executionProofService.ts`, `machineExecutionProofProfiles.ts` | Not invoked; Base proof qualification remains separate; no native Solana/Robinhood claim |
| Application UI | current SpendTerminalPage, Radar shell, design constitution | No changes; prior visual approval is not inherited as Spend Lab release approval |
| Agent tooling | existing SDK plus official Agents SDK documentation | Intent-only seam; deterministic agents run offline, LLM deployment remains future work |

## Prohibited operations

Staging/production deploy, public payment activation, real provider purchases, wallet credentials, production signing keys, blanket execution capability, application database migrations, automatic baseline approval, merge and self-issued independent review remain prohibited. No provider URLs or network executor exist in the default runner. Reports explicitly preserve HOLD.

## Remaining qualification gaps

No paid end-to-end x402 Spend Lab run; no real external settlement; no trusted external evaluator; no cost/fee invoice or economic accuracy labels; no measured baseline counterfactual outcome; no distributed or production load claim; no independent security/migration/accessibility approval; no image/runtime release qualification. Current local results cannot establish that Radar makes real decisions cheaper or better. `initial_preference` records a synthetic dissent prompt, not a demonstrated market outcome. These unknowns are null in the report.
