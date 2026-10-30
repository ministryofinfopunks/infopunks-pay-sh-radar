# One Radar. Two Economies. One Standard of Proof.

Infopunks Radar is the intelligence and evidence layer before spending or onchain action. Pay.sh is a spend rail. Canonical Judgment assesses an action under policy. Separately authorized infrastructure executes. Receipts preserve accountability; only eligible accepted Evaluations can inform reputation. No receipt, no trust.

## Journeys and navigation

Shared product destinations: Radar `/`, Solana `/solana`, Robinhood Chain `/rh-chain-signal-desk`, Proof `/#proof`, Developers `/developers`. Existing chain menus retain deep links. Mobile product links wrap and retain 44px touch targets. A shared catalog (`productCatalog.ts`) owns entry descriptions and lifecycle copy. Shared tokens (`designTokens.css`) define charcoal/bone colors, severity, surfaces, radius, spacing, typography, focus and short motion. Responsive transitions use 960/820/680px boundaries; reduced motion removes motion duration and smooth scrolling.

Landing: exact hero constitution → Run a Check `/spend-terminal` (labeled advisory) → Explore the Radar `/#economies` → two economic cards → Observation/Judgment/Execution/Evaluation → minimal canonical API example. No landing data fetch, performance numbers, sample canonical receipts, live badge or ecosystem-token promotion.

Solana: should this agent spend? Terminal → describe agent/intent/budget/risk/service payment method/confidence/optional deep-linked subject → inspect canonical verdict, accepted evidence count, assessment fee, expiry and receipt availability → inspect route evidence. A quoted 402 assessment remains unpaid and unissued; the browser has no payment/signature action. Retry uses the same key for the same input. A changed input gets a fresh key. Missing/stale evidence abstains for free. Display canonical fields, never upgrade the legacy diagnostic `ALLOW` label. Subject network does not advertise native Solana fee settlement.

Robinhood Chain: does this market deserve trust? Landing uses **Inspect a Market** `/rh-chain-signal-desk/market`, then contract/pool/market source inspection through existing desk, dossiers, market structure and `/4663` research. Existence, quotes and depth are different from action suitability. No Check a Market marketing until a canonical market policy and independently reviewed evidence are qualified. Inspection can degrade/unavailable on provider failure; sources and unknowns stay visible. `/4663` is a Radar research entry, not a competing trust product.

Proof: lifecycle explanation plus public legacy diagnostic evidence `/receipts`. Production synthetic legacy seeds are disabled. Existing approved sanitized RH publication read models remain usable. Raw canonical receipt/context/tape/attempt/witness/accounting reads require operator authentication and always return `private, no-store`. No unauthenticated Decision View is introduced. Canonical proofs cannot be selected for publication by a caller. General tenant authentication and public publication manifests remain blocked and must receive a separate authority design/review.

Developers: `POST /v1/pre-spend/check` remains canonical. `/v1/decide` is a facade over the same authority and payment journal. `execution_authorized:false` and `execution_authorization:null` are explicit at both HTTP boundaries. Unsupported capability is never turned into execution permission.

## Shared Judgment contract

Existing request fields and hashes remain compatible. Agent ID is an identity label, not tenant authentication. Intent, budget, risk tolerance, service payment preference and confidence threshold preserve current semantics. The additive optional `judgment_context` uses `radar-judgment-context.v1`, a closed subject registry and a strict object schema. Typed HTTP requests reject unknown top-level keys. Legacy requests retain existing additive compatibility.

```json
{
  "agent_id": "your-agent",
  "intent": "buy_market_research",
  "budget": 25,
  "risk_tolerance": "low",
  "preferred_settlement": "stablecoin",
  "required_confidence": 80,
  "subject_id": "solana:mainnet:service_route:route_identifier",
  "judgment_context": {
    "version": "radar-judgment-context.v1",
    "subject": {
      "type": "service_route",
      "id": "solana:mainnet:service_route:route_identifier",
      "network": "solana:mainnet"
    },
    "policy": { "id": "solana.service-spend", "version": "1" },
    "evidence_refs": ["accepted_observation_identifier"],
    "settlement_network": "eip155:8453",
    "expires_at": "2026-10-12T12:00:00Z"
  }
}
```

This is a schema example, not live proof or a paid call. Pass `Idempotency-Key` in the header. Expiry is a caller ceiling, bounded further by server TTL and evidence freshness. The expired example must abstain when used after its timestamp. `preferred_settlement` describes the proposed service payment method. `judgment_context.settlement_network` requests the **Judgment fee** rail. It must equal the configured gateway's network. Neither derives from `subject.network`; unsupported/disabled settlement abstains without challenge. Existing rail code is Base USDC and RH USDG, both separately gated; no live rail qualification is asserted.

Registry: Solana service_route/provider/machine_payment_endpoint; RH token_contract/liquidity_pool/stock_token_market/market_operation. IDs start with `<network>:<type>:`; RH identities require contract/pool hex identity. Policy/network/type combinations cannot cross domains. Representability does not mean qualification: only service_route is admitted to the v1 typed service policy. Provider/endpoint subjects abstain until reviewed evidence semantics are implemented. Unknown version/type/policy is a validation error, never a fallback approval.

## Evidence adapters and frozen policy

`JudgmentEvidenceAdapter.resolve` produces domain, typed subject, exact policy/version, accepted canonical observations, deterministic blockers and execution_authorized:false. Adapter code is in `judgmentEvidenceAdapters.ts`; it cannot sign, settle, write execution/evaluation receipts or follow client URLs.

The Solana service adapter requires namespaced route identity, matching top-level subject, server observation references and server provenance containing subject_network/policy_id/policy_version. It then enters the existing `assessFrozenDecision` gates: hash integrity, intent hash, live nonfixture evidence, required proofs, identity/intent/constraints, price/budget/service settlement, consistent reviewed decision, confidence, blockers, bounded-test permission, freshness and relevant historical veto. Positive reputation cannot fill a gap. Provider legitimacy/reliability/delivery are retained as reviewed service facts, not computed from market signals. If independently reviewed facts are absent, abstain.

The RH adapter normalizes existing stored `PltrPreflightState` with canonical identity, matching pool, quote direction, depth primitive, stock-token basis, freshness and data gaps. The service loads stored snapshots only on RH requests; no RPC/refresh/market computation is added to unrelated service checks. Missing store/provider state becomes explicit blockers. Market existence does not map to `proceed`. Unqualified execution policy and independent historical market evaluation always produce `insufficient_evidence`, fee 0, no payment challenge or canonical paid receipt. A future qualified adapter needs a new reviewed frozen policy and independently authorized evidence issuance; it cannot reuse service-delivery reputation or legacy labels.

One authority: `createJudgmentService` → adapter admission → `assessFrozenDecision` → existing frozen DecisionContext → canonical receipt authority/payment journal. Existing v2 contexts bind the parsed typed extension through request_hash/intent_hash, and offline verification uses the same deterministic rules. Legacy bytes/hashes are preserved; no schema migration is required for additive JSON context.

Canonical outcomes: proceed; test_spend_first (only explicitly bounded); do_not_spend (evidence-bound veto); insufficient_evidence (free/no paid receipt). Evidence adapters never author confidence to override gates.

## Trust and operational boundaries

Observation → Judgment → Execution → Evaluation uses existing append-only, hash-bound ancestry, signed issuer and frozen accepted-history boundaries. Settlement claim uniqueness prevents replay; ambiguous failures remain pending reconciliation. Only external verified eligible execution and accepted classified evaluations contribute to a subject-scoped derived score. Production Evaluation/score authority remains closed pending independent E1 qualification. There is no global market/service trust score.

Operator bearer authentication is the current private-read boundary, not tenant support. Unauthenticated/wrong-token callers receive the same 401 before object lookup. Production legacy receipt/claim/validation intake stays unavailable, even to an operator, until durable storage and publication policy are qualified. Paid production endpoints require operator authority; signed paid requests also require operator authority. Public integrations are limited to safe free checks until tenant-bound identity and policy access are reviewed. Browser forms never collect operator tokens or signing secrets.

PostgreSQL remains canonical; memory is development/test only. Migrations 001–022 remain checksummed and externally applied. No new DDL, infrastructure dependency or production configuration is introduced. Readiness must fail for mandatory unavailable dependencies; liveness only means the process can respond. Keep one replica and require an operator-provided edge limiter before staging exposure. No unreviewed proxy trust expansion. Structured Judgment events expose decision, policy/domain, accepted evidence count, charge state and request correlation, never intent text, bearer credentials or raw observations.

## Capability matrix

| Capability | Implemented | Local qualification | Staging | Production |
|---|---|---|---|---|
| Unified landing/navigation | Yes | New evidence packet | Not deployed | Not asserted |
| Advisory service check | Shared canonical authority | Tests + real local free check | Live evidence/catalog pending | Not asserted |
| Typed route Judgment | Closed policy + provenance admission | Synthetic positive/negative replay | Reviewed live observations pending | Paid/tenant qualification blocked |
| RH market inspection | Existing read-only desk/market | Browser including degradation | RPC/data evidence pending | Not asserted |
| RH canonical trading authorization | Disabled | Negative/free boundary tested | Blocked | Blocked |
| Canonical private proof | Operator-only | Authorization/replay tested | Data/privacy approval pending | Not asserted |
| Independent Evaluation/reputation | Production gate closed | Synthetic eligibility/regression tests | E1 blocked | Blocked |
| Native Solana fee settlement | Unsupported | Abstention tested | Unsupported | Unsupported |
| Base/RH payment code | Gated existing code | Mocked settlement/restart tests | Real rail qualification pending | Not asserted |
| IPX/PLTR operations | Inert existing code | No activation | Out of scope | Out of scope |

## Observability and release compatibility

Structured events cover request correlation/status/duration, canonical decision/domain/accepted-evidence counts, unsupported-policy rejection, evidence freshness, payment challenge/verification/settlement/duplicate prevention, proof rejection and the Judgment critical path. Payment telemetry cannot interrupt settlement journaling. `RADAR_QUERY_TIMING_ENABLED=true` enables shared PostgreSQL client-query durations without logging SQL, parameters, URLs or identities. `scripts/summarize-radar-observability.mjs` derives request volume and p50/p95/p99 from a supplied log using bounded memory; missing decision/payment/query events remain unknown. Existing provider catalog/RPC cache health and receipt replay checks remain separate sources. A shared production telemetry/alert collector, real RPC/payment rates and representative capacity baseline require staging bindings; no production SLO is asserted from test data.

Legacy console fragment links now target `/solana#…`; `/#proof` and `/#economies` belong to the universal landing. `/solana#methodology` opens the existing methodology dialog. Canonical free checks remain compatible, while raw proof reads, qualified quotes/receipts and payment signatures require operator authority. Production legacy publication/intake remains 503 even for an operator. This intentional authorization change must be reviewed before release; no HOLD branch is merged or deployed here.
