# Stock Token and RWA intelligence: first product lane

The automatic Signal Desk remains the foundation. Stock Token and RWA evidence is now the first specialized lane above that foundation. Humans enter through `/4663` to investigate current conditions; applications use a bounded evidence service before a proposed action. CALL follows investigation and keeps its existing resolution and proof semantics. Memes and general discovery remain available.

## Candidate scope

Branch: `codex/rh-pipeline-1b-stock-rwa`.

Stacked local base: `270cccdb439ee6929d5dab4c778061c1e1b8581f`, the qualified RH-PIPELINE-1A candidate. Its integration ancestor is `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`. This does not establish approval to merge into another integration or release branch.

Code SHA: `50277a1a879270f95f86b8b60b81cc26288c8260`.

This increment implements a public, storage-only evidence projection, an exact-contract lookup, explicit input coverage and a connection from persisted official Stock Token identities to the existing opt-in market collector. It does not complete RH-PIPELINE-1B, automate the issuer registry/reference collectors, or launch the paid service.

| Input | Reused implementation | Current coverage and limits |
| --- | --- | --- |
| Registry identity | `ReflexiveRadarService`, persisted `CanonicalStockAsset` | Official RHJ provenance, active chain-4663 deployments, exact contracts; conflicting contract/asset identities excluded. A registry listing conveys identity, not safety or legal rights. |
| Corporate actions | Current/pending multiplier metadata | Source presence is preserved. Legacy default `1` cannot become observed evidence. Pending changes suppress basis. Full event history, issuer terms and adjustment completeness are unavailable. |
| Issuer/reference price | Persisted `PltrPreflightState.underlying_reference` | PLTR only; validates midpoint, source method, age, session and alignment. Other Stock Tokens explicitly have missing reference coverage. |
| Chain activity | Persisted PLTR canonical supply; DEX transaction observations | Supply and block provenance are separate from indexed DEX activity. No claim of complete transfer/mint/burn coverage. |
| Liquidity | Durable RH-PIPELINE-1A snapshots | One selected provider pool, missing values preserved, source/fetch time distinguished. Rolling volume is not capital inflow; liquidity is not executable capacity. |
| Route evidence | Existing PLTR V4 preflight inputs and pure pool-key verification | Exact pool required; fresh depth/supply/reference/registry, aligned open-session basis and existing simulation prerequisites. `INPUTS_PRESENT` never grants execution permission. Live quotes remain unavailable. |
| Other RWA assets | No qualifying registry currently connected | Explicit `UNAVAILABLE`; Stock Token evidence is not extended by ticker or narrative to unrelated RWA instruments. |

## Read contract

`GET /v1/4663/stock-tokens` lists qualified persisted identities, exclusions and source age. `GET /v1/4663/stock-tokens/{contract}/evidence` returns the exact-contract evidence view. Optional `route=pltr_uniswap_v4_simulation&pool_id={bytes32}` evaluates input coverage for one existing simulation route.

Both routes reject wallet and unknown query fields, use public field allowlists and `Cache-Control: no-store`, perform no provider collection, and have no receipt, wallet, payment or authorization dependency. Provider failure preserves the age of stored evidence. Storage failure returns a generic 503 without provider fallback. The new read path does not automatically submit evidence to an economic authority adapter.

The full product coverage remains `INCOMPLETE` because issuer terms and full corporate-action history are not collected. Per-input freshness booleans and counts make that gap inspectable. Source refresh timestamps do not replace observation timestamps. The examples in [api-examples.json](evidence/rh-stock-evidence/api-examples.json) are synthetic fixtures, not measured live market coverage.

The existing scheduler flags remain off by default. When locally opted in, the durable collector includes the persisted official stock universe alongside existing discovery. This does not schedule refreshes of the RHJ registry or reference prices. It preserves the existing collector cap, replay/locking controls and history retention; a commercial universe must qualify universe size and coverage explicitly.

## Next implementation sequence

1. Finish specialized collection inside the existing observation pipeline. Store issuer/registry identity and source manifests with exact chain/contract mappings, field completeness and historical revisions. Collect reference quotes with their original timestamps, currency, session and adjustment basis; handle outages without replacing last-known evidence with fresh-looking timestamps. Use bounded, leased jobs and durable replay controls. Add provider adapters without making the public evidence contract depend on RHJ's field names.
2. Add issuer-backed corporate-action events and effective-time history. Freeze the multiplier and reference basis applicable to each observation. Refuse comparisons across unresolved action boundaries. Distinguish splits, distributions, redemption and other terms only when their issuer evidence supports that interpretation. Add independent reference reconciliation and explicit disagreement states.
3. Qualify one specified Stock Token route before widening coverage. Bind chain, input/output contracts, pool/router, direction, size, quote timestamp/expiry, fees, slippage constraints and simulation evidence. Confirm hook and session behavior. Provider liquidity and a successful fee settlement cannot substitute for route execution evidence. Feed reviewed evidence adapters through existing judgment/policy gates; introduce no parallel authority path.
4. Finish dynamic Today/movers and `/4663` integration from persisted observations. Lead NOW/WATCH/OPEN LOOPS with qualified Stock Token/RWA developments, source age and unresolved evidence checks. Preserve secondary meme/discovery views and CALL semantics. Complete daily factual editions separately from reviewed Daily Receipts.
5. Qualify the paid decision facade with authenticated application identity, request/evidence linkage, evaluation and independently reconciled fees. Pricing, payment activation, execution activation and production rollout remain separate release decisions. No such activation is part of this candidate.

## Success metric contracts

These are measurement definitions and source mappings, not implemented counters or current business results. The new evidence GET routes are not verified preflight calls.

| Metric | Counting rule | Existing source / missing work |
| --- | --- | --- |
| Verified preflight calls | Unique authenticated application + idempotent request + exact asset/route intent + frozen evidence + canonical signed judgment with valid ancestry. Report covered, abstained and incomplete requests separately. | Existing canonical observation/judgment receipts and judgment journal; Stock/RWA intent/evidence adapter and authenticated application attribution still required. Self-reported `machine_id` or `principal_id` alone is insufficient. |
| Returning applications | Authenticated applications with qualifying calls in at least two distinct UTC reporting periods; report cohort and denominator. | Existing engine principal/trace fields can support linkage after a verified gateway identity is established. Host-admin authentication is not per-application identity. |
| Evidence coverage | Fresh, valid required evidence slots divided by required slots for the exact asset/route/version; also report source age, disagreement and missing slots. | This candidate exposes partial read coverage. Commercial route policy needs its own full requirement set and frozen request-time manifest. |
| Decision accuracy | Versioned rubric against independently established outcome evidence, with fixed evaluation windows; abstention/unevaluated rates reported separately. | Existing evaluation receipts and evaluator provenance. `confirmed` alone is not investment accuracy; externally claimed outcomes require verification and a Stock/RWA rubric. |
| Successful execution evaluations | Deduplicated judgment→authorized execution→verified execution evidence→verified evaluation chains satisfying the declared task. Report failures and pending finality in the denominator. | Existing execution/evaluation receipts and protected engine trace records. Finalized payment transfers prove payment, not that a Stock Token route executed successfully. Current external execution payload/status claims are not independently verified trade outcomes. |
| Attributable fee revenue | Finalized, independently verified merchant transfers linked through the complete judgment/payment journal, deduplicated by settlement and product request. Separate refunds, recorded costs and attribution gaps; report per rail/asset without invented currency conversion. | `economicAccountingService` and `settled_judgment_revenue`; `/v1/economics/revenue` is settlement-backed. Product/application attribution and refund reconciliation still need qualification. Static revenue templates and charged-but-unsettled judgments do not count. |

## Boundaries and release verdict

No CALL/RESOLUTION, Genesis, cryptographic proof, IPX economics, judgment authority or publication-gate implementation was changed. No fee collection, trading, public publishing activation, production configuration, deployment, push or merge was performed. No new migration or dependency was added; this increment reuses the 17 integration-base migrations plus RH-PIPELINE-1A migration `20261012_024_rh_market_observation_history`.

Local evidence qualification is recorded in [qualification.json](evidence/rh-stock-evidence/qualification.json). Production, paid-service readiness, general RWA coverage, complete corporate-action/reference collection and full RH-PIPELINE-1B–1D remain **HOLD**. Existing local tests are not deployment or production proof.

## Delivery and verification inventory

Code changed in exactly six files relative to the stacked base:

- `src/services/rhChainStockEvidenceService.ts`: persisted evidence projection, exact identity, input coverage, freshness, privacy allowlists and pure route evidence checks.
- `src/api/rhChainStockEvidenceRoutes.ts`: strict read-only HTTP contracts and generic storage failure handling.
- `src/api/app.ts`: routes, store injection and official stock identities in the existing collector watchlist.
- `src/api/openapi.ts`: machine-readable endpoint documentation.
- `src/services/rhChainReflexiveRadarService.ts`: source-field availability for multiplier metadata; existing calculation and authority behavior preserved.
- `tests/rh-stock-evidence.test.ts`: 20 focused cases, including real app injection and opt-in scheduling fixtures.

No frontend source was changed. Browser/device/accessibility qualification and frontdoor ETag/revalidation work remain part of RH-PIPELINE-1D. Existing frontend regressions run in the full suite, but are not browser release evidence.

Rollback this increment to stacked base `270cccdb439ee6929d5dab4c778061c1e1b8581f`; the previous observation collector and its migration remain. No schema down migration is required for this JSON projection increment. Keep existing Phase 2/3 publication gates and production configuration unchanged. The market scheduler, ingestion and history flags retain their existing opt-in defaults; there is no new paid-product activation flag.

The verification environment is local macOS/Node with disposable PostgreSQL 14.20, not Linux or a deployed runtime. Local evidence uses synthetic assets and prices. It does not demonstrate live issuer coverage, public uptime, provider availability, successful trades or attributable revenue. See the committed qualification artifact for final counts, hashes and explicit PASS/HOLD findings.

Final frozen-code qualification: **263 files / 1,932 tests passed**, zero failures or skips, including disposable PostgreSQL integration tests. All **20** new evidence tests passed. Typecheck, lint, build and diff checks passed. Local evidence foundation: **PASS**; the product and production gates above remain **HOLD**.
