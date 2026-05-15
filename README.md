# Infopunks Pay.sh Radar

Infopunks Pay.sh Radar is a live intelligence layer for the Pay.sh ecosystem.

It tracks providers, monitors service health, scores trust and ecosystem activity, and helps users discover reliable Pay.sh services in real time.

Pay.sh handles payments and discovery.  
Infopunks Radar adds intelligence, monitoring, and coordination on top.

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
- `GET /v1/events/recent`
- `GET /v1/graph`

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
- `GET /v1/radar/benchmarks`
  Returns head-to-head benchmark registry records (including metrics-pending scaffolds).
- `GET /v1/radar/benchmarks/finance-data-sol-price`
  Returns the SOL price benchmark scaffold with proven route proof references. This is not a winner claim.
  `output_shape` is a schema example, not extracted metric data.
  `extracted_price_usd` remains `null` until normalized extraction is recorded.
  `benchmark_recorded` remains `false` until normalized head-to-head metrics exist.
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
- Next step: record normalized head-to-head benchmark metrics.

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
| `INFOPUNKS_ADMIN_TOKEN` | Required for admin ingestion and monitoring routes |
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
```

---

# Deployment

## Split Mode (Static Frontend + Backend API)

- Static frontend: `https://radar.infopunks.fun`
- Backend API: `https://infopunks-pay-sh-radar.onrender.com`
- Required static frontend environment variable:

```env
VITE_API_BASE_URL=https://infopunks-pay-sh-radar.onrender.com
```

In split mode, the frontend must call the backend API URL directly instead of relative `/v1/*` paths.

---

## Render Backend

Recommended runtime:

- Node.js 20+

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm start
```

Render automatically provides:

```env
PORT
```

Set `DATABASE_URL` to enable Postgres persistence.

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

# License

MIT
