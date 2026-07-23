# Infopunks Pay.sh Radar

Infopunks is the pre-spend intelligence layer for autonomous markets.

Before your agent pays, it checks Infopunks.

Radar turns route evidence, receipts, validation, and public route intelligence into receipt-backed pre-spend decisions. This is not a payment execution client. Pay.sh can handle payment and discovery; Radar is the intelligence layer before payment.

## Current Evidence Ledger State

- 5 recorded benchmarks
- 5 explored scaffold lanes
- 6 artifacts
- 40 recorded route-runs
- 10 proven paid routes
- 0 winner claims

Recorded lanes contain artifact-backed route evidence.

Scaffold lanes are not failed benchmarks. They are lanes where Radar found insufficient comparable paid evidence.

`GET /v1/radar/evidence-ledger` is the core agent-facing endpoint for inspecting the ledger before spend.

## Agent Spend Readiness Cards

Agent Spend Readiness Cards expose proof-state diagnostics for builders. They are not rankings and do not claim winners.

Builders can inspect what Radar knows about each provider or route before agents spend: recorded benchmark evidence, route timelines, controlled bundle run references, scaffold lanes, caveats, and suggested next steps.

- `GET /v1/radar/agent-readiness`
- `GET /v1/radar/agent-readiness/:provider_id`

Pay.sh is the spend rail. Radar is the evidence ledger. The Harness is the proof adapter.

## Pre-Spend SDK

Before an agent pays, it checks Infopunks.

```ts
import { createInfopunksPreSpendClient } from "infopunks-pay-sh-radar/sdk";

const client = createInfopunksPreSpendClient({
  baseUrl: "https://radar.infopunks.fun"
});

const decision = await client.checkPreSpend({
  agent_id: "agent_001",
  intent: "buy_market_research",
  budget: 25,
  risk_tolerance: "low",
  preferred_settlement: "stablecoin",
  required_confidence: 75
});
```

The SDK calls `POST /v1/pre-spend/check`.

Production base URL: `https://radar.infopunks.fun`

Responses are receipt-backed pre-spend decisions.

This is not a payment execution client.

See the minimal agent flow in [examples/pre-spend-agent](/Users/ahdilm/Documents/Infopunks%20Pay.sh%20Intelligence%20Terminal/examples/pre-spend-agent/README.md:1).

## Infopunks Proof Feed

Infopunks Proof Feed is Community Notes for the agent economy.

It extends Radar with a public receipt-check layer for claims, projects, wallets, providers, routes, services, tweets, and market narratives. Agents can spend. Infopunks helps them judge.

- `/check`
- `/check/:checkId`
- `POST /v1/check`
- `GET /v1/checks`
- `GET /v1/checks/:checkId`

The MVP is deterministic and seeded. It produces an Infopunks Receipt Card with claim, claim type, receipts found, evidence strength, risk flags, validation status, decision state, and a shareable public URL.

Decision states:
- `trust`
- `caution`
- `do_not_use_yet`
- `unproven`
- `disputed`

No receipt, no trust.

## Loop Check

Infopunks Loop Check connects loop engineering directly to Proof Feed.

Autonomous loops generate claims, checks, receipts, and public memory. Every loop should be checkable. Every loop check should produce a proof receipt.

- `/loops`
- `/loops/:loopId`
- `GET /v1/loops`
- `GET /v1/loops/:loopId`
- `POST /v1/loops/check`

Seeded loop examples include pre-spend route discipline, provider trust, failure memory, machine service route readiness, and carbon claim integrity. Each loop links back to a proof receipt through `linked_check_id`.

## LoopLab Launch Surface

Infopunks LoopLab is where autonomous work becomes collective memory.

`/loops` now acts as the public launch surface for loop engineering inside Radar. It includes:

- LoopLab hero positioning and launch CTAs
- collective memory counters
- a “How the loop works” explainer
- screenshot-friendly Loop Receipt Cards
- a Failure Wall for cautionary and under-evidenced loops
- linked Proof Receipt Cards on `/loops/:loopId`

AI is moving from prompts to loops. LoopLab turns autonomous runs into proof receipts so the next agent does not start from zero.

## Signal Hunt

Signal Hunt is the community intake layer for Infopunks. It captures early CT and market signals, attaches evidence, routes them into Proof Feed and LoopLab, and helps transform cultural attention into reusable pre-spend intelligence for agents.

Core stack:

- Signal Hunt is the front door.
- Proof Feed is the receipt printer.
- LoopLab is the memory engine.
- Pre-Spend Terminal is the agent judgment layer.
- Evidence Ledger makes claims traceable.
- Provider Reputation makes trust reusable.

- `/signal-hunt`
- `/signal-hunt/:signalId`
- `GET /v1/signal-hunt`
- `GET /v1/signal-hunt/:signalId`
- `POST /v1/signal-hunt/submit`
- `POST /v1/signal-hunt/:signalId/verify`

Signal Hunt turns CT attention into reusable intelligence. Culture finds the edge. Infrastructure makes it durable.

## Manual QA Checklist

- Pages: verify `/`, `/developers`, `/spend-terminal`, `/check`, `/loops`, `/signal-hunt`, `/routes`, `/providers`, `/services`, `/receipts`, `/claim`, and linked detail pages render without React errors.
- Copy: verify public pages use `Pre-Spend Intelligence`, `Before your agent pays, it checks Infopunks.`, `No receipt, no trust.`, `known blockers`, `safer alternatives`, `human validation`, and `evidence graph`.
- API: verify `POST /v1/pre-spend/check`, `POST /v1/check`, `GET /v1/checks`, `GET /v1/loops`, `GET /v1/loops/:loopId`, `POST /v1/loops/check`, `GET /v1/signal-hunt`, `GET /v1/signal-hunt/:signalId`, `POST /v1/signal-hunt/submit`, `POST /v1/signal-hunt/:signalId/verify`, `GET /v1/routes`, `GET /v1/pre-spend/providers`, `GET /v1/services`, `GET /v1/receipts`, `POST /v1/receipts`, `POST /v1/validation/submit`, `GET /v1/claims`, `POST /v1/claims`, `GET /v1/claims/:claim_id/challenges`, and `GET /openapi.json`.
- SDK: verify the package export `import { createInfopunksPreSpendClient } from "infopunks-pay-sh-radar/sdk";` still works against `https://radar.infopunks.fun`.
- Terminal: verify the spend terminal still returns decision states including `approved`, `approved_with_warning`, `use_with_caution`, `requires_human_approval`, and `do_not_use`.
- Evidence links: verify route, provider, service, receipt, and claim pages link to related receipts where available.
- Claims: verify `/claim` shows route decision → receipt → claim → validation → reputation, receipt references, known blockers, safer alternatives, and challenge placeholders.

```bash
curl -s -X POST "https://radar.infopunks.fun/v1/pre-spend/check" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_001",
    "intent": "buy_market_research",
    "budget": 25,
    "risk_tolerance": "low",
    "preferred_settlement": "stablecoin",
    "required_confidence": 75
  }' | jq
```

## Production Smoke QA

Run the deployment smoke check against production:

```bash
npm run smoke:production
```

Override the base URL for local or preview verification:

```bash
SMOKE_BASE_URL=http://localhost:8787 npm run smoke:production
```

The production smoke script is mostly read-only. It verifies public pages, `openapi.json`, the pre-spend API, and claims primitives. The default run does not create new claims or challenges in production.

---

# What Radar Does

- Tracks Pay.sh providers and services
- Monitors provider availability and latency
- Scores trust and ecosystem activity
- Detects provider changes over time
- Builds provider intelligence profiles
- Surfaces ecosystem trends and narratives
- Recommends routes based on trust and signal quality

Radar is designed to help humans and agents understand the state of the Pay.sh ecosystem without replacing Pay.sh itself.

---

# Core Concepts

## Trust Score

The Trust Score estimates how reliable a provider appears based on available evidence such as:

- service availability
- response latency
- metadata quality
- pricing clarity
- freshness of observations
- monitoring evidence

Radar does not invent telemetry.

Unknown or unavailable signals remain explicitly unknown.

---

## Signal Score

The Signal Score measures ecosystem momentum and activity around a provider.

This includes:

- provider activity density
- category activity
- endpoint breadth
- ecosystem movement over time

Signal measures ecosystem relevance and momentum, not correctness or safety.

---

## Provider Intelligence

Each provider receives a live intelligence profile that can include:

- trust score
- signal score
- monitoring evidence
- recent changes
- endpoint inventory
- latency observations
- ecosystem category data
- risk indicators
- unknown telemetry visibility

---

## Narrative Heatmap

Radar surfaces which categories and providers appear to be gaining momentum across the ecosystem.

This helps identify:

- emerging providers
- ecosystem concentration
- active infrastructure clusters
- changing market behavior

---

# Architecture

```text
Pay.sh Ecosystem
        ↓
Infopunks Ingestion Layer
        ↓
Canonical Event System
        ↓
Trust + Signal Engines
        ↓
Provider Intelligence Layer
        ↓
Realtime Radar Interface
```

Every ecosystem observation becomes a structured event that Radar can analyze over time.

No black-box score is emitted without supporting evidence.

---

# API Overview

## Machine Discovery

- `GET /openapi.json`
  Returns the OpenAPI 3.1 description for implemented public Radar routes.

The OpenAPI spec is intended for builders and agents. It documents request/response shapes, examples, CSV export routes, risk/history routes, readiness routes, and the safe-metadata/no-paid-execution constraint.

Radar does not execute paid Pay.sh provider APIs from these routes. It exposes catalog-derived intelligence, safe metadata reachability signals, event history, advisory risk, and export surfaces only.

## Agent-First UI

- `Agent Mode`
  Top-level toggle that removes narrative panels and shows routing/action surfaces: Agent Preflight, batch preflight hint, accepted/rejected candidates, risk warnings, cost/performance context, benchmark readiness, exports, API Docs, Copy JSON, and Copy curl.
- `Cmd+K` on macOS or `Ctrl+K` elsewhere
  Opens the command palette.
- `API Docs`
  Visible in the top nav, Export Intelligence panel, Agent Preflight panel, and Agent Mode banner. It opens `/openapi.json`.
- `Terminal Comfortable` / `Terminal Dense`
  Optional density toggle for changing card padding, chip density, and row spacing without changing backend behavior.

Command palette actions include:

- Focus Semantic Search
- Open Agent Preflight
- Open Compare
- Open Cost / Performance
- Open Benchmark Readiness
- Open API Docs
- Export Providers JSON
- Export Endpoints JSON
- Export Providers CSV
- Export Endpoints CSV
- Toggle Agent Mode
- Jump to Degradations
- Jump to Selected Dossier
- Jump to Anomaly Watch

## Ecosystem

- `GET /health`
- `GET /version`
- `GET /v1/pulse`
- `GET /v1/pulse/summary`
- `GET /v1/narratives`
- `GET /v1/signal-hunt`
- `GET /v1/events/recent`
- `GET /v1/graph`

## Public Signal Stack

- `Signal Hunt`
  Community intake layer for early CT and market signals.
- `Proof Feed`
  Receipt-check layer that records whether a signal has evidence.
- `LoopLab`
  Memory engine that turns outcomes into reusable public loop history.
- `Evidence Ledger`
  Traceability layer for proof, artifacts, and benchmark memory.
- `Pre-Spend Terminal`
  Agent judgment layer that uses evidence before spend.
- `Provider Reputation`
  Reusable trust surface built from claims, checks, routes, and proof.

---

## Providers

- `GET /v1/providers`
- `GET /v1/providers/:id`
- `GET /v1/providers/:id/history`
- `GET /v1/providers/:id/intelligence`

---

## Endpoints & Monitoring

- `GET /v1/endpoints`
- `GET /v1/endpoints/:id/history`
- `GET /v1/endpoints/:id/monitor`
- `GET /v1/monitor/runs/recent`

---

## Radar Exports (Read-Only)

- `GET /v1/radar/scored-catalog`
  Returns the current scored catalog snapshot with provider and normalized endpoint intelligence.
- `GET /v1/radar/providers`
  Returns provider-level intelligence records only.
- `GET /v1/radar/endpoints`
  Returns normalized endpoint-level intelligence records.
- `GET /v1/radar/routes/candidates`
  Returns route-eligible endpoint/provider candidates grouped by category and provider.
- `GET /v1/radar/risk/providers/:provider_id`
  Returns advisory predictive risk + explainable anomalies for one provider.
- `GET /v1/radar/risk/endpoints/:endpoint_id`
  Returns advisory predictive risk + explainable anomalies for one endpoint.
- `GET /v1/radar/risk/ecosystem`
  Returns compact ecosystem risk summary (counts, top anomalies, affected categories, recent critical events, anomaly watch).
- `POST /v1/radar/preflight`
  Runs safe agent preflight route intelligence from catalog-derived evidence only.
- `POST /v1/radar/compare`
  Compares 2-3 providers or endpoints across route-readiness metrics.
- `GET /v1/radar/superiority-readiness`
  Returns route superiority benchmark readiness indicators from verified/proven registry mappings. Readiness means comparison can begin, not that a superiority winner is claimed.
- `GET /v1/radar/benchmark-readiness`
  Returns benchmark readiness by category/task with benchmark-ready vs superiority-ready split.
- `GET /v1/radar/evidence-ledger`
  Returns the compact agent-facing ledger endpoint for pre-spend inspection.
- `GET /v1/radar/evidence-ledger/brief`
  Returns a smaller agent-facing ledger brief derived from the full evidence ledger, excluding route timelines and raw artifact bodies.
- `GET /v1/radar/bundles`
  Returns a read-only bundle registry for agent spend recipes with execution boundaries and evidence references. Radar does not execute paid APIs from this route.
- `GET /v1/radar/bundles/:bundle_id`
  Returns one bundle registry record by bundle id (`morning-briefing`, `market-research`, `talent-market-scanner`).
- `GET /v1/radar/bundles/:bundle_id/runs`
  Returns a read-only Bundle Run Ledger summary for controlled live run Harness proof records. Radar does not execute paid APIs and does not mark bundles recorded.
- `GET /v1/radar/bundles/:bundle_id/runs/:run_id`
  Returns full read-only Bundle Run Ledger detail for one controlled live run Harness proof record, including caveated execution facts and skipped review-required steps.
- `POST /v1/radar/bundles/:bundle_id/plan`
  Bundle Planner (non-executing). Returns an evidence-aware route plan derived from Bundle Registry + Evidence Ledger metadata before spend. Harness execution comes later.
- `GET /v1/radar/benchmarks`
  Returns head-to-head benchmark registry records (including metrics-pending scaffolds).
- `GET /v1/radar/benchmarks/finance-data-sol-price`
  Returns the SOL price benchmark record with artifact-backed normalized evidence. This is not a winner claim.
- `GET /v1/radar/benchmarks/finance-data-token-search`
  Returns the finance/data token-search benchmark with recorded normalized evidence.
  `benchmark_recorded=true` means normalized evidence has been recorded.
- `GET /v1/radar/benchmarks/finance-data-token-metadata`
  Returns the finance/data token-metadata benchmark scaffold (planned lane).
  `benchmark_recorded=false` means no normalized benchmark evidence exists yet.
  `winner_status=not_evaluated` means agents must not use it as routing proof.
  `routes=[]` means no comparable proven routes are recorded as benchmark evidence yet.
  `benchmark_recorded=true` means normalized evidence has been recorded.
  `winner_claimed=false` means no route superiority result is claimed yet.
  `winner_status` can be `not_evaluated | insufficient_runs | no_clear_winner | provisional_winner | winner_claimed`.
  `winner_policy` defines proof-before-claims criteria (minimum runs, success rate, confidence, latency metric, and scoring weights).
  Five runs per route can satisfy run-count criteria while still resulting in `no_clear_winner` until scoring thresholds are finalized.

## Bundle Planner Examples

Bundle Planner is documentation and planning only. It derives route-plan output from the read-only Bundle Registry and Evidence Ledger metadata. Radar does not execute paid APIs here, does not call Pay.sh, and does not add Harness execution from these examples.

Morning Briefing:

```bash
curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/morning-briefing/plan \
  -H "content-type: application/json" \
  -d '{
    "topic": "AI, crypto, world news",
    "constraints": {
      "max_cost_usd": 0.05,
      "allow_billing_unclear": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data'
```

Market Research:

```bash
curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/market-research/plan \
  -H "content-type: application/json" \
  -d '{
    "topic": "Circle Internet Group",
    "constraints": {
      "max_cost_usd": 0.10,
      "allow_billing_unclear": false,
      "allow_billable_probe_observed": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data.blocked_steps'
```

Talent Market Scanner:

```bash
curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/talent-market-scanner/plan \
  -H "content-type: application/json" \
  -d '{
    "topic": "AI engineer",
    "constraints": {
      "max_cost_usd": 0.05,
      "allow_billing_unclear": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data'
```
  Winner evaluation can legitimately end with `no_clear_winner`.
  `winner_rationale` explains why a winner is not claimed after policy evaluation.
  `status_code` can be `null` in `pay_cli` mode.
  `status_evidence` explains proof basis when HTTP status is not exposed.
  `extracted_price_usd` is artifact-backed benchmark evidence, not live-refreshed by Radar.
  Route rows may include aggregate fields:
  `success_rate`, `median_latency_ms`, `p95_latency_ms`, `average_price_usd`, `min_price_usd`, `max_price_usd`, `price_variance_percent`, `completed_runs`, `failed_runs`.
- `GET /v1/radar/benchmarks/:benchmark_id/history`
  Returns artifact-backed history timeline entries plus additive rollup fields:
  `first_recorded_at`, `latest_recorded_at`, `artifact_count`, `latest_artifact_id`, `total_recorded_runs`, `routes_count`, `winner_status`, `winner_claimed`, `route_summaries`.
- `GET /v1/radar/benchmark-history`
  Returns aggregate artifact-backed history rollups across all known benchmarks.
- OCR fixtures:
  [https://radar.infopunks.fun/fixtures/ocr-benchmark-001.svg](https://radar.infopunks.fun/fixtures/ocr-benchmark-001.svg)
  [https://radar.infopunks.fun/fixtures/ocr-benchmark-001.png](https://radar.infopunks.fun/fixtures/ocr-benchmark-001.png)
  Purpose: Canonical fixture for `document-ocr-text-extraction` benchmark.
  Preferred for paid OCR route verification: PNG fixture.
- Audio fixture:
  [https://radar.infopunks.fun/fixtures/audio-benchmark-001.wav](https://radar.infopunks.fun/fixtures/audio-benchmark-001.wav)
  Purpose: Canonical fixture for `audio-speech-transcription` benchmark.
  Expected transcript fragments:
  `INFOPUNKS RADAR`
  `EVIDENCE BEFORE SPEND`
  `AUDIO BENCHMARK 001`
  Speech recognizers may transcribe `001` as `zero zero one`; future normalization should accept both:
  `AUDIO BENCHMARK 001`
  `AUDIO BENCHMARK ZERO ZERO ONE`
- `GET /v1/radar/benchmark-artifacts`
  Returns curated/imported benchmark artifact metadata records used by Radar benchmark summaries.
- `GET /v1/radar/benchmark-artifacts/:artifact_id`
  Returns one curated/imported benchmark artifact metadata record.
  Raw proof contents are not served.
  Radar does not execute paid APIs from artifact routes.
- `POST /v1/radar/preflight/batch`
  Runs multiple safe preflight checks in one request (max 25) with per-query success/error.
- `GET /v1/radar/export/providers.csv`
- `GET /v1/radar/export/endpoints.csv`
- `GET /v1/radar/export/route-candidates.csv`
- `GET /v1/radar/export/degradations.csv`
  Read-only CSV exports with normalized safe fields only.

These export routes are read-only JSON views. They do not execute paid Pay.sh APIs.
CSV routes are also read-only and do not execute paid Pay.sh APIs.

Cost/performance fields are catalog-estimated unless execution evidence exists:
- `pricing_known`, `estimated_min_price`, `estimated_max_price`, `pricing_unit`, `pricing_source`
- `pricing_confidence`: `unknown | low | medium | high`
- `price_description`, `trust_per_estimated_dollar`, `signal_per_estimated_dollar`
- `route_value_score`, `value_score_reason`

Rules:
- Unknown pricing stays unknown (`pricing_known=false`).
- Broad ranges (example `$0-$100`) are low-confidence catalog estimates.
- Superiority is never claimed from catalog metadata only.

Benchmark Readiness note:
- StableCrypto SOL price route is proven.
- PaySponge CoinGecko SOL pool search route is proven.
- Benchmark-ready category: `finance/data` with intent `get SOL price`.
- No superiority winner is claimed yet.
- Five-run benchmark evidence is recorded with no clear winner.
- Next step: define scoring thresholds before declaring a route winner.

---

## Intelligence

- `GET /v1/trust/:entity_id`
- `GET /v1/signal/:entity_id`
- `POST /v1/search`
- `POST /v1/recommend-route`
- `POST /v1/preflight`
- `GET /v1/preflight/schema`

---

## Admin Routes

Requires `INFOPUNKS_ADMIN_TOKEN`.

- `POST /v1/ingest/pay-sh`
- `POST /v1/monitor/run`

---

# Route Recommendation Example

```bash
curl -s -X POST http://localhost:8787/v1/recommend-route \
  -H 'content-type: application/json' \
  -d '{
    "task":"find a high trust AI provider",
    "preference":"highest_signal",
    "trustThreshold":80
  }'
```

Primary request field:

```json
{
  "trustThreshold": 80
}
```

Backward-compatible alias:

```json
{
  "minTrustScore": 80
}
```

If both are present, `trustThreshold` takes precedence.

---

# Preflight Example

```bash
curl -s -X POST http://localhost:8787/v1/preflight \
  -H 'content-type: application/json' \
  -d '{
    "intent":"agent checkout settlement",
    "category":"Payments",
    "constraints":{
      "minTrustScore":80,
      "maxLatencyMs":400,
      "maxCostUsd":0.05
    },
    "candidateProviders":["alpha","beta"]
  }'
```

The response includes:

- `decision` (`route_approved` or `route_blocked`)
- `selectedProvider`
- `rejectedProviders` with deterministic reason codes
- `candidateCount`
- `routingPolicy`
- `generatedAt`
- `dataMode` and `source` so clients can distinguish `live`, `cached`, or `fallback` intelligence

---

# Agent Preflight (Radar)

`POST /v1/radar/preflight`

Input shape:

```json
{
  "intent": "get SOL price",
  "category": "finance",
  "constraints": {
    "min_trust": 80,
    "prefer_reachable": true,
    "require_pricing": true,
    "max_price_usd": 0.01
  }
}
```

Example curl:

```bash
curl -s -X POST http://localhost:8787/v1/radar/preflight \
  -H 'content-type: application/json' \
  -d '{
    "intent":"get SOL price",
    "category":"finance",
    "constraints":{
      "min_trust":80,
      "prefer_reachable":true,
      "require_pricing":true,
      "max_price_usd":0.01
    }
  }'
```

Output shape:

```json
{
  "generated_at": "2026-05-12T00:00:00.000Z",
  "source": "infopunks-pay-sh-radar",
  "input": {},
  "recommended_route": {},
  "accepted_candidates": [],
  "rejected_candidates": [],
  "warnings": [],
  "superiority_evidence_available": false
}
```

`superiority_evidence_available` is `true` only when there are at least two executable mappings in the same category and benchmark-ready comparison conditions exist.

If only one executable mapping exists, Radar should be interpreted as:

`Repeatability evidence available. Superiority evidence not yet available.`

Radar does not execute paid APIs in this mode. It ranks and rejects using safe metadata, trust/signal intelligence, reachability, pricing clarity, and mapping completeness only.

Radar preflight also includes additive `predictive_risk` context per candidate. This context is heuristic/advisory:

- `critical` risk is rejected by default unless `constraints.allow_risky_routes=true`
- `elevated` risk reduces confidence and recommends fallback routing
- `watch` risk adds caution/monitor guidance
- `unknown` risk warns about insufficient history but does not auto-reject

## Predictive Risk Model (Advisory)

Radar predictive risk is explainable and additive. It does **not** replace trust/signal formulas and does **not** claim certainty.

Risk levels:

- `low`
- `watch`
- `elevated`
- `critical`
- `unknown` (insufficient history unless current critical evidence exists)

Implemented anomaly types:

- `sudden_trust_drop`
- `sudden_signal_spike`
- `repeated_degradation`
- `repeated_failed_metadata_check`
- `latency_spike`
- `route_eligibility_flip`
- `pricing_metadata_disappeared`
- `metadata_quality_decline`
- `catalog_metadata_churn`
- `stale_catalog_source`
- `critical_current_state`

All risk routes are read-only and safe. Radar does not execute paid Pay.sh APIs for predictive risk checks.

---

# Live Pay.sh Catalog Ingestion

Radar can ingest the live Pay.sh catalog when:

```env
PAY_SH_CATALOG_URL=https://pay.sh/api/catalog
```

If the live catalog becomes unavailable or malformed, Radar falls back to a bundled fixture dataset for deterministic local development and testing.

Fallback state is exposed transparently through:

- `GET /v1/pulse`
- `GET /v1/pulse/summary`

Radar does not invent endpoint telemetry that the source catalog does not provide.

---

# Monitoring

Radar includes safe metadata monitoring for provider reachability and operational visibility.

Safe monitoring can:

- check provider reachability
- measure latency
- detect degraded providers
- track recovery events

Safe monitoring does **not**:

- execute paid Pay.sh operations
- send payment headers
- validate paid endpoint correctness
- verify settlement success

Monitoring is designed to collect operational evidence without triggering payable API execution.

---

# Current Limitations

Radar currently observes:

- catalog metadata
- provider availability
- ecosystem structure
- monitoring evidence

Radar does not yet verify:

- paid execution success
- payment settlement reliability
- transaction throughput
- receipt-level payment validation

Those capabilities require direct telemetry, receipts, or routing-layer integrations.

---

# Tech Stack

## Backend

- TypeScript
- Fastify
- Zod
- Postgres
- Vite

---

## Persistence

When `DATABASE_URL` is configured, Radar persists data using Postgres.

Core tables include:

- `infopunks_events`
- `ingestion_runs`
- `monitor_runs`
- `intelligence_snapshots`

RH Chain durable tables are created idempotently by their owning storage
adapters. They include `rh_chain_signal_submissions`, the metrics, meme,
launchpad and risk snapshot tables, the receipt draft and published receipt
tables, the snapshot cache, and the automation lock/run/draft tables. A failed
initial schema check is retried by the next request; it is never downgraded to
memory when `DATABASE_URL` is configured.

Without `DATABASE_URL`, Radar uses an in-memory repository for fast local development and testing.

---

# Quick Start

## Install

```bash
npm install
```

---

## Run Development Environment

```bash
npm run dev
```

Backend:

```text
http://localhost:8787
```

Frontend:

```text
http://localhost:5173
```

---

## Production Build

```bash
npm run build
NODE_ENV=production PORT=8787 npm start
```

---

# Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Enables Postgres persistence |
| `DATABASE_POOL_MAX` | Maximum connections in the shared RH Chain Postgres pool (default `10`) |
| `INFOPUNKS_ADMIN_TOKEN` | Required for admin ingestion and monitoring routes |
| `RH_CHAIN_AUTOMATION_ENABLED` | Enables RH Chain draft/snapshot automation; production requires `DATABASE_URL` |
| `RH_CHAIN_AUTOMATION_INSTANCE_ID` | Safe instance label recorded with durable automation locks |
| `RH_CHAIN_MARKET_INGESTION_ENABLED` | Independently enables admin-gated RH Chain DEX Screener snapshot capture; defaults to `false` |
| `RH_CHAIN_MARKET_HISTORY_ENABLED` | Independently enables normalized historical snapshot writes; production requires `DATABASE_URL`; defaults to `false` |
| `DEXSCREENER_ENABLED` | Enables the existing RH Chain DEX Screener market/attention adapter; defaults to `false` |
| `RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED` | Enables persisted-memory Attention Quality v2 behind the existing routes; defaults to `false` |
| `DEXSCREENER_BASE_URL` | DEX Screener API origin; defaults to `https://api.dexscreener.com` |
| `DEXSCREENER_RH_CHAIN_ID` | Fixed RH Chain identifier; the only accepted value is `robinhood` |
| `DEXSCREENER_TIMEOUT_MS` | Abortable upstream request timeout; default `2500` |
| `DEXSCREENER_CACHE_TTL_SECONDS` | Fresh in-memory provider-cache TTL; default `120` |
| `DEXSCREENER_STALE_WHILE_REVALIDATE_SECONDS` | Bounded background-refresh window after fresh TTL; default `30` |
| `DEXSCREENER_STALE_IF_ERROR_SECONDS` | Bounded stale fallback window after provider errors; default `300` |
| `DEXSCREENER_MAX_STALE_SECONDS` | Absolute stale-data ceiling; default `900` |
| `DEXSCREENER_MAX_BATCH_SIZE` | Maximum exact contracts per token batch; capped at `30` |
| `DEXSCREENER_MAX_RETRIES` | Retry budget for 429, 5xx, timeout, and network failures; default `2`, maximum `5` |
| `DEXSCREENER_RETRY_BASE_MS` | Base delay for exponential backoff with jitter; default `100` |
| `DEXSCREENER_MAX_CONCURRENCY` | Maximum simultaneous upstream requests; default `4`, maximum `20` |
| `DEXSCREENER_RATE_LIMIT_PER_SECOND` | Maximum provider request starts per second; default `20`, maximum `100` |
| `RH_CHAIN_REVIEW_CONSOLE_ENABLED` | Enables protected internal RH review routes |
| `RH_CHAIN_REVIEW_ADMIN_TOKEN` | Dedicated bearer credential required when the production review console is enabled |
| `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED` | Enables durable authoritative reviewed-classification APIs and the read-only Cross-Layer integration; defaults to `false` and requires `DATABASE_URL` in production |
| `PULSE_PUBLIC_HOST` | Trusted canonical RH Pulse hostname without a scheme or path; defaults to `pulse.infopunks.fun` |
| `RH_PULSE_CALLS_ENABLED` | Enables signed-call APIs and UI only when a durable window is also open; defaults to `false`; production requires Postgres and the internal token |
| `RH_PULSE_CHALLENGE_TTL_SECONDS` | Single-use EIP-191 challenge lifetime; defaults to `300`, bounded from `60` to `900` |
| `RH_PULSE_INTERNAL_TOKEN` | Server-only bearer credential for pilot-window controls; never expose through `VITE_` |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional public WalletConnect project ID; injected wallets keep working when omitted |
| `PAY_SH_CATALOG_URL` | Live Pay.sh catalog source |
| `PAY_SH_INGEST_INTERVAL_MS` | Enables scheduled ingestion |
| `MONITOR_ENABLED` | Enables scheduled monitoring |
| `MONITOR_MODE` | Monitoring mode |
| `MONITOR_INTERVAL_MS` | Monitoring interval |
| `MONITOR_TIMEOUT_MS` | Monitoring timeout |
| `MONITOR_MAX_PROVIDERS` | Max providers checked per run |
| `FRONTEND_ORIGIN` | Restricts frontend CORS |
| `VITE_API_BASE_URL` | Frontend API base URL |

---

# Example Environment

```env
NODE_ENV=production
PORT=8787
INFOPUNKS_ADMIN_TOKEN=your-token
PAY_SH_CATALOG_URL=https://pay.sh/api/catalog
MONITOR_ENABLED=true
MONITOR_MODE=safe_metadata
MONITOR_INTERVAL_MS=900000
PULSE_PUBLIC_HOST=pulse.infopunks.fun
RH_PULSE_CALLS_ENABLED=false
RH_PULSE_CHALLENGE_TTL_SECONDS=300
RH_PULSE_INTERNAL_TOKEN=
VITE_WALLETCONNECT_PROJECT_ID=
```

## RH Pulse Phase 1 through Phase 3A

RH Pulse is a separate public front door over the shared Radar engine. The production hostname is `https://pulse.infopunks.fun/`; local and Radar-host fallback access is `/rh-pulse`. The same Fastify/Vite application chooses the public shell from the trusted hostname or fallback path, while all existing Radar routes retain their current behavior.

The evidence API remains read-only:

- `GET /v1/rh-pulse`
- `GET /v1/rh-pulse/connections`
- `GET /v1/rh-pulse/current-window`
- `GET /v1/rh-pulse/methodology`
- `GET /v1/rh-pulse/source-health`

Phase 2 adds single-use EIP-191 challenges, atomic calls, public calls/receipts and authenticated pilot-window controls. Phase 3A adds deterministic exact-input resolution drafts, separate approval, one immutable Rotation Receipt per window, community accuracy and public correct/incorrect call states:

- `GET /v1/rh-pulse/resolutions`
- `GET /v1/rh-pulse/resolutions/:windowId`
- `GET /v1/rh-pulse/rotation-receipts/:receiptId`
- `/rh-pulse/resolutions/:windowId`
- `https://pulse.infopunks.fun/resolutions/:windowId`

Apply `migrations/20260723_007_rh_pulse_signed_calls.up.sql` and `migrations/20260723_008_rh_pulse_rotation_resolutions.up.sql` in order before a pilot. Calls remain disabled by default, and the outstanding physical-device wallet matrix continues to block production enablement. There is no transaction, chain switch, automatic scheduler or dynamic receipt image. Wallet and WalletConnect code remain asynchronous and do not enter the initial Radar/Pulse bundles. See [docs/rh-pulse-v1.md](docs/rh-pulse-v1.md) for scoring, input-manifest, approval, receipt, migration, security and pilot runbooks and [the host-routing ADR](docs/architecture/rh-pulse-host-routing.md) for canonical-host authority.

The destructive-safe real-Postgres production gate requires local PostgreSQL 14.x command-line tools and creates only the exact isolated database `postgresql://postgres@127.0.0.1:55463/rh_pulse_gate`. The all-in-one gate applies every migration in order, runs signed-call plus resolution concurrency/rollback/immutability/multi-process suites, and destroys the temporary cluster even after failure:

```bash
npm run test:rh-pulse:postgres
```

For inspection or an explicit lifecycle, use `npm run test:postgres:up`, `npm run test:postgres:migrate`, and `npm run test:postgres:down`. The gate fails when PostgreSQL is absent, has the wrong major version, or the database URL is not the exact isolated target; it never falls back to mocks or the in-memory adapter.

## RH Chain market-data provider setup

For the gated migration sequence, authenticated readiness endpoint, Render variable matrix, pilot receipt procedure, and flag-first rollback, see [the RH Chain production rollout runbook](docs/rh-chain-production-rollout.md). The non-mutating schema check is `npm run rh-chain:migration-status -- --environment=staging --require-ready`.

DEX Screener is used only as a market and attention sensor. It does not define the complete Robinhood Chain index, establish token identity from a ticker, change reviewed classifications, or create approved signals. All provider calls run server-side through the existing adapter; browser components never call DEX Screener directly.

Enable live market reads with `DEXSCREENER_ENABLED=true`. Enable the admin capture path separately with `RH_CHAIN_MARKET_INGESTION_ENABLED=true`. Enable writes separately with `RH_CHAIN_MARKET_HISTORY_ENABLED=true`; production history requires Postgres. Legacy `RH_CHAIN_AUTOMATION_ENABLED=true` continues to enable both capture and storage for backward compatibility.

The adapter validates every upstream payload at runtime and supports token market lookup, token pool lookup, pair lookup, token profiles, latest/top boosts, paid token orders, ads, and community-takeover metadata on chain id `robinhood`. Requests use abortable timeouts, bounded retry with exponential backoff and jitter for 429/5xx/transient transport failures, a concurrency ceiling, provider start-rate limiting, and `Retry-After` when supplied.

Apply the additive Postgres migration before enabling new production history:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_001_rh_chain_market_snapshot_memory.up.sql
```

The paired `.down.sql` removes only the new columns and indexes, retaining the legacy snapshot table and token/captured-at index.

### Market-data provenance and limitations

Normalized pair observations include provider, capture time, provider time when supplied, cache provenance/status, freshness, raw-data version, exact token and pair addresses, base/quote metadata, DEX/labels, price, liquidity, FDV/market cap, volume/transaction/price-change windows, boosts/orders, websites, and socials. Derived Infopunks fields remain separated from raw provider observations and include freshness and confidence.

DEX Screener coverage depends on pools it indexes and may be partial, delayed, cached, or absent. Provider timestamps are not present on every endpoint. Boosts and paid orders describe paid visibility only; they do not prove manipulation or organic demand. Community-takeover/profile/order metadata can be missing or change independently of pair data. Stale responses are visibly marked, bounded by `DEXSCREENER_MAX_STALE_SECONDS`, and never promoted into reviewed truth.

### Robinhood Chain Market Pulse

`/rh-chain-signal-desk/market` is the public market-structure view backed by `GET /v1/rh-chain/market`. It aggregates the canonical pair for each exact tracked contract into a rolling 24-hour observation and compares it with the preceding stored observation window. Every metric carries capture time, freshness, confidence, and provenance; missing comparison history remains null and produces a visible warning instead of an inferred trend.

Layer composition comes only from reviewed Infopunks classifications. DEX Screener supplies market and paid-attention context, never the complete chain index or a classification decision. The headline and supporting interpretation use the versioned deterministic ruleset `deterministic_rules_v1`; no LLM runs in the request path and the output is not an investment recommendation. The existing `/rh-chain-signal-desk/live-snapshot` surface and API remain available and are cross-linked from Market Pulse.

Market Pulse needs no additional environment variable or database migration beyond the separately flagged market ingestion and snapshot-history foundation above. With the provider or history disabled, it returns a calm partial or unavailable state and does not fabricate zero-valued market totals.

### Durable reviewed classifications

Durable reviewed classifications are a separate, feature-flagged authority boundary for Robinhood Chain products. Exact contract identity and reviewed memory outrank provider context. Provider observations, Discovery Queue actions, and Review Pipeline actions may remain useful intake context, but they cannot approve, promote, publish, or write this repository. The repository remains isolated from Market Pulse, 4663/RCCI, Signal Graph, and public project pages. The only downstream integration is the separately described, read-only Cross-Layer adapter, and it is active only under the same reviewed-classification feature flag.

The feature is disabled by default. In production, apply the additive migration first, then set `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED=true`. Protected `/internal/rh-chain/classifications...` routes additionally require the existing `RH_CHAIN_REVIEW_CONSOLE_ENABLED=true`, `RH_CHAIN_REVIEW_ADMIN_TOKEN`, bearer authorization, and an `x-rh-chain-reviewer-id` header for writes. The read-only `GET /v1/rh-chain/classifications` route returns only active approved records and redacts reviewer audit metadata and manual-override rationale.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_002_rh_chain_reviewed_classifications.up.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_003_rh_chain_classification_layer_vocabulary.up.sql
```

Application startup never runs this migration or any classification DDL. Startup readiness checks only verify that the expected tables exist when the feature is enabled. Roll back before disabling or removing the feature with:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_003_rh_chain_classification_layer_vocabulary.down.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260719_002_rh_chain_reviewed_classifications.down.sql
```

Migration `20260719_003` additively admits `consumer` as a primary reviewed layer. Its down migration refuses to proceed while any consumer-primary record exists, preventing a destructive vocabulary rollback. Apply its down migration before `20260719_002` only after those records have been deliberately reclassified.

The Postgres repository stores one current validated record per `(chain, contract)` and an immutable audit snapshot for every accepted transition. Row locking, version predicates, primary/foreign keys, unique constraints, and database checks protect concurrent updates. Local development and deterministic tests can use the matching in-memory implementation. All reads validate stored JSON before returning it, paging is capped at 100 records per request, and malformed storage fails closed without leaking raw database errors.

Supported states are `proposed`, `source_required`, `under_review`, `approved`, `rejected`, `superseded`, and `archived`. Approval, rejection, and supersession require the caller's expected classification version; stale writers receive a conflict with the current validated record. Rejected, superseded, or archived records can be proposed again only with their expected version, retaining prior transitions in audit history.

The public Discovery Queue and Review Pipeline routes remain available with their existing response envelopes and behavior. Their mutation routes remain non-authoritative and do not write the reviewed-classification tables.

### Cross-Layer Intersections integration

The canonical public surfaces remain `GET /v1/rh-chain/market-structure/cross-layer` and `/rh-chain-signal-desk/market-structure/cross-layer`. No parallel Intersections API or classification flow exists. With `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED` unset or `false`, the established Cross-Layer service and UI response are preserved. With it enabled, a read-only adapter joins reviewed exact-contract classifications to the latest persisted market snapshots in one bounded preload; it never calls DEX Screener or another provider from the public request path.

Classification precedence is explicit:

1. Existing curated reviewed memory.
2. Durable, approved, effective, non-superseded, non-archived exact-contract classifications.
3. Provider context, which may enrich market fields but cannot establish a layer.
4. Unknown.

If curated and durable reviewed memory disagree, the curated classification remains public, the public record carries a conflict warning, and the disagreement is available to authenticated reviewers at `GET /internal/rh-chain/market-structure/cross-layer/conflicts`. That route is read-only and uses the existing Review Console bearer guard. Reviewers resolve the underlying classification through the existing protected `/internal/rh-chain/classifications...` operations; there is no second mutation flow.

Public eligibility requires exact contract identity, a curated or approved-active durable classification, at least two meaningful reviewed layers, evidence supporting the displayed classification, and no critical identity conflict. `ai-narrative` is a secondary context label and never proves agent activity. Unknown and incomplete classifications remain counted in coverage and source-required disclosures but stay outside the public project list. A reviewed project without a validated persisted snapshot remains visible with an explicit market-data-unavailable state.

Aggregates use methodology `cross_layer_intersections_v1`. Counts, liquidity, volume, concentration, classification coverage, and market-data coverage describe at most 100 reviewed exact contracts and their latest persisted snapshots. They are not complete Robinhood Chain totals. Derived responses are cached for 60 seconds with capture time, freshness, confidence, classification provenance, provider provenance, warnings, and the bounded-universe disclosure retained.

#### Conflict-resolution runbook

1. Enable the existing Review Console guard and query the internal conflict endpoint with the reviewer bearer token.
2. Verify the exact contract and compare the curated and durable layer evidence; never resolve from ticker, branding, socials, or DEX descriptions alone.
3. Use the existing classification audit endpoint to inspect history, then use the existing approve, reject, supersede, or re-propose operation with the current classification version.
4. Update curated reviewed memory through its established review process if it is the stale side. The integration deliberately continues to warn until both authorities agree.
5. Re-check the internal conflict endpoint and canonical public Cross-Layer response. No provider refresh is required for a classification resolution.

#### Safe staging rollout

1. Back up the database and apply migrations `20260719_002` and `20260719_003` explicitly; application startup never runs them.
2. Keep `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED=false`, deploy, and verify Market Pulse, Live Snapshot, 4663, RCCI, Signal Graph, Discovery Queue, Review Pipeline, Review Console, and the legacy Cross-Layer response.
3. Seed and approve a small exact-contract staging set through the existing protected classification API. Capture market history separately if enrichment is desired.
4. Enable `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED=true` in staging. Verify the conflict surface, classification and market-data coverage, zero provider requests in the Cross-Layer path, canonical metadata, social card, mobile layout, and accessibility states.
5. Resolve curated/durable disagreements or accept their visible warning state, then enable production during a reversible window. Roll back by setting the flag to `false`; this immediately restores the legacy Cross-Layer path without deleting durable memory.

Known limitations: the integration is deliberately bounded to 100 reviewed records, uses the latest persisted snapshot rather than request-time provider data, and does not infer a complete chain index. Curated memory has no durable classification version, so conflicts require reviewer interpretation. Sparse evidence summaries can keep otherwise approved records out of public intersections. Provider coverage may be delayed or absent, and market-data unavailability does not invalidate reviewed classification evidence.

---

# Deployment

The existing `GET /v1/rh-chain/live-snapshot/token/:contract` route uses a single request-scoped deadline. Its production-safe internal budget defaults to 3.8 seconds through `RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS`; configuration above 4 seconds is rejected, leaving headroom beneath the five-second production smoke deadline. Provider timeouts remain governed by `RH_CHAIN_PROVIDER_TIMEOUT_MS` but are capped by the remaining route budget. Slow providers produce explicit partial or unavailable sections while completed and valid cached observations retain provenance and freshness. Cache writes and stale refreshes never block the public response.

## Unified Render Deployment

`https://radar.infopunks.fun` and `https://pulse.infopunks.fun` should point at the same full Node/Fastify app, not a Render Static Site.

Use a Render Web Service so one process serves:

- `/v1/*`
- `/openapi.json`
- frontend static assets from `dist/client`
- host-aware SPA fallback for Radar and RH Pulse frontend pages only

Do not deploy either public hostname as a Static Site publishing `dist/client`, or the HTML shell will swallow API URLs and Pulse cannot receive server-injected canonical metadata.

---

## Render Service

Recommended runtime:

- Node.js 20+
- Render Web Service

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start:render
```

Render automatically provides:

```env
PORT
```

Set `DATABASE_URL` to enable Postgres persistence. It is mandatory when
`RH_CHAIN_AUTOMATION_ENABLED=true`; Render must inject it at runtime from the
attached Postgres service. `DATABASE_POOL_MAX` is runtime-only and may be set
to the connection budget assigned to this web service. Do not expose either
value through `VITE_` variables or build arguments.

Before enabling RH Chain automation on Render, confirm the runtime database
role can connect and can idempotently create tables and indexes in its target
schema. No destructive migration is required for the RH recovery change: the
existing `create table/index if not exists` statements preserve all records.

The checked-in [render.yaml](/Users/ahdilm/Documents/Infopunks%20Pay.sh%20Intelligence%20Terminal/render.yaml:1) codifies the expected Render Web Service configuration.

Attach both custom domains to that same service. Keep `PULSE_PUBLIC_HOST=pulse.infopunks.fun` and `RH_PULSE_CALLS_ENABLED=false` until migrations `007`/`008`, the resolution pilot, and the outstanding physical-device wallet matrix all pass. DNS for `pulse.infopunks.fun` should use the target Render provides for the attached custom domain; no second service or database is required.

Production sanity check:

- `https://infopunks-pay-sh-radar.onrender.com/openapi.json` should return `application/json`
- `https://infopunks-pay-sh-radar.onrender.com/v1/loops` should return `application/json`
- `https://infopunks-pay-sh-radar.onrender.com/v1/checks` should return `application/json`
- `https://infopunks-pay-sh-radar.onrender.com/rh-pulse` should return the RH Pulse HTML shell
- `https://pulse.infopunks.fun/v1/rh-pulse` should return `application/json`

If the `onrender.com` service returns JSON but `https://radar.infopunks.fun/...` returns `text/html`, the custom domain is attached to the wrong Render service, usually a Static Site that serves `dist/client`. Reattach `radar.infopunks.fun` to the Node Web Service defined in `render.yaml` and redeploy the blueprint.

---

# Docker

## Build Image

```bash
docker build -t infopunks-pay-sh-radar .
```

---

## Run Container

```bash
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e PORT=8787 \
  -e INFOPUNKS_ADMIN_TOKEN=local-admin \
  infopunks-pay-sh-radar
```

---

# Validation

```bash
npm test
npm run typecheck
npm run build
```

---

# Production Verification

Run production proof-surface verification:

```bash
npm run verify:production
```

Override base URL (staging/local):

```bash
RADAR_VERIFY_BASE_URL=https://your-endpoint.example.com npm run verify:production
RADAR_VERIFY_BASE_URL=http://localhost:8787 npm run verify:production
```

Default base URL:

```text
https://infopunks-pay-sh-radar.onrender.com
```

---

# Local Smoke Commands

## Health

```bash
curl -s http://localhost:8787/health
```

---

## Recent Events

```bash
curl -s http://localhost:8787/v1/events/recent
```

---

## Provider Intelligence

```bash
curl -s http://localhost:8787/v1/providers/stableenrich/intelligence
```

---

## Trigger Ingestion

```bash
curl -s -X POST http://localhost:8787/v1/ingest/pay-sh \
  -H 'authorization: Bearer local-admin' \
  -H 'content-type: application/json' \
  -d '{}'
```

---

## Trigger Monitoring

```bash
curl -s -X POST http://localhost:8787/v1/monitor/run \
  -H 'authorization: Bearer local-admin'
```

---

# Philosophy

Infopunks Radar is not a competing payment rail, marketplace, wallet, or token-gated layer.

Pay.sh handles payment and discovery.

Radar focuses on ecosystem intelligence, monitoring, coordination, and operational visibility above the Pay.sh economy.

---

# Future Direction

Radar is the first step toward a broader cognitive coordination layer for machine-native economies.

Future layers may include:

- realtime routing intelligence
- receipt-aware execution monitoring
- ecosystem graph intelligence
- agent reputation memory
- coordination-aware routing systems
- narrative and behavioral analysis across machine economies

---

# RH Chain frontend performance

RH Chain feature surfaces load as route-level chunks: Market Pulse, Meme Pulse, Token Dossiers, Clone Radar, Scouts, Distribution Pack, and the internal Review Console. The desk landing and its core public routes remain eagerly available so pathname-based metadata and route detection stay stable.

Vite may still report a large shared entry chunk. That chunk is the existing application shell, which contains the broad non-RH route registry plus the eager RH Chain desk shell; it is intentionally not split until the wider router is decomposed. The production smoke plan covers RH Chain public and read-only API routes without submitting signals.

## RH Chain Project Claims and Intelligence Receipts

Project Claims is gated by `RH_CHAIN_PROJECT_CLAIMS_ENABLED=false` by default. The public directory additionally requires `RH_CHAIN_PROJECT_DIRECTORY_ENABLED=true`; immutable project receipts additionally require `RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED=true`. In production these flags require `DATABASE_URL` and the normal migration runner must apply `20260719_005_rh_chain_project_claims.up.sql` before enabling either surface.

Public submissions only queue intake. They are not endorsements, verification, reviewed classifications, verdicts, Attention Quality inputs, or future scoring inputs. Exact Robinhood Chain contracts establish identity; names and slugs are presentation only. Reviewers use the existing Review Console token and reviewer attribution header to create observations, review claims, draft/approve verdicts, and publish receipts.

Published project Intelligence Receipts carry a deterministic SHA-256 integrity hash. They are not edited or deleted: a correction publishes a replacement receipt and supersedes the original with a public reason and bidirectional linkage. Roll back safely by disabling the three flags first; this hides the public surfaces while preserving migrated records and existing Signal Vault, dossiers, classifications, Daily Receipts, and evaluation flows.

## Unified RH Chain sharing

Market Pulse, Cross-Layer, Attention Quality, Project Claims, Project Intelligence Receipts, Daily Receipts, and 4663 use a single public-only deterministic sharing model. It reuses canonical URLs, freshness, confidence, methodology, receipt hashes, and correction history; it does not create a second receipt engine or call providers on a share read path. Published Project Intelligence Receipt cards are server-rendered at `/og/rh-chain/share/:receipt_id.png`; drafts and reviewer-only material return no card.

Share controls support native share, copy insight, and canonical receipt links with accessible feedback. Distribution Pack eligibility is separate from promotion, so public records are never auto-amplified. Full privacy, deterministic-template, card-cache, feature-flag, rollout, and rollback details are in [the RH Chain sharing architecture](docs/rh-chain-sharing.md).

# License

MIT
