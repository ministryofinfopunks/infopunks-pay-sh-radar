# Infopunks Pay.sh Radar

Infopunks Pay.sh Radar is the V1 Cognitive Coordination Layer above the Pay.sh agent economy.

Core principle: Pay.sh is the payment and discovery substrate. Infopunks is the intelligence layer above it. This project does not build a competing marketplace, payment rail, wallet layer, or token-gated experience.

## Build Order Implemented

1. Canonical event spine
2. Pay.sh ingestion
3. Provider and endpoint registry
4. Deterministic trust scoring
5. Deterministic signal scoring
6. Pulse API
7. Provider intelligence API
8. Semantic search
9. Route recommendation API
10. Minimal terminal-style frontend
11. Endpoint monitoring and latency evidence

## Architecture

```text
Pay.sh Ecosystem
-> Infopunks Ingestion Layer
-> Canonical Event Spine
-> Provider + Endpoint Registry
-> Trust Engine
-> Signal Engine
-> Narrative Engine
-> Coordination Engine
-> Reputation Memory Layer
-> Ecosystem Graph Layer
-> Realtime Cognitive Market Interface
```

## Backend

- TypeScript
- Fastify
- Zod schemas
- Postgres persistence when `DATABASE_URL` is set
- In-memory repository fallback for local development and tests
- Deterministic scoring only
- Clear evidence objects for every scored component
- Unknown/null values for unavailable telemetry

## Routes

- `GET /health`
- `GET /version`
- `GET /v1/pulse`
- `GET /v1/pulse/summary`
- `GET /v1/providers`
- `GET /v1/providers/:id`
- `GET /v1/providers/:id/history`
- `GET /v1/providers/:id/intelligence`
- `GET /v1/endpoints`
- `GET /v1/monitor/runs/recent`
- `GET /v1/endpoints/:id/monitor`
- `GET /v1/endpoints/:id/history`
- `GET /v1/trust/:entity_id`
- `GET /v1/signal/:entity_id`
- `GET /v1/narratives`
- `GET /v1/events/recent`
- `POST /v1/search`
- `POST /v1/recommend-route`
- `POST /v1/ingest/pay-sh` admin-only with `INFOPUNKS_ADMIN_TOKEN`
- `POST /v1/monitor/run` admin-only with `INFOPUNKS_ADMIN_TOKEN`
- `GET /v1/graph`

Route recommendation request field naming:

- Primary field: `trustThreshold`
- Backward-compatible alias: `minTrustScore`
- If both are present, `trustThreshold` takes precedence

Example:

```bash
curl -s -X POST http://localhost:8787/v1/recommend-route \
  -H 'content-type: application/json' \
  -d '{"task":"find a high trust AI provider","preference":"highest_signal","trustThreshold":80}'
```

## Data Models

Core Zod schemas live in `src/schemas/entities.ts`:

- `InfopunksEvent`
- `Provider`
- `Endpoint`
- `PricingModel`
- `TrustAssessment`
- `SignalAssessment`
- `NarrativeCluster`
- `RouteRecommendation`

## Event Spine

Every ingested catalog fact becomes an `InfopunksEvent`. Providers, endpoints, pricing models, trust assessments, signal assessments, narratives, search results, and route recommendations reference evidence objects derived from those events.

No black-box score is emitted without supporting evidence. If a signal stream is missing, the field is `null` and appears in `unknowns`.

## Trust Scoring V1

Trust components:

- `uptime`: scored from real endpoint monitor evidence when available, otherwise `null`
- `responseValidity`: scored from monitor schema validation evidence when available, otherwise `null`
- `metadataQuality`: scored from Pay.sh catalog metadata events
- `pricingClarity`: scored from Pay.sh pricing events
- `latency`: scored from real monitor response time evidence when available, otherwise `null`
- `receiptReliability`: `null` until Pay.sh receipt events exist
- `freshness`: scored from latest catalog observation event

The final score is a weighted average over known components only.

## Signal Scoring V1

Signal components:

- `ecosystemMomentum`: scored from catalog endpoint breadth events
- `categoryHeat`: scored from observed provider density by category
- `metadataChangeVelocity`: `null` until repeated metadata snapshots exist
- `socialVelocity`: `null` until social/dev streams are ingested
- `onchainLiquidityResonance`: `null` until onchain/liquidity events exist

The final score is a weighted average over known components only.

## Pay.sh Live Catalog Ingestion

Radar ingests the public Pay.sh catalog first when `PAY_SH_CATALOG_URL` is set. The recommended production value is:

```bash
PAY_SH_CATALOG_URL=https://pay.sh/api/catalog
```

If the remote catalog is unavailable or malformed, Radar falls back to the bundled fixture and exposes that state explicitly as `data_source.mode: "fixture_fallback"` on both `GET /v1/pulse` and `GET /v1/pulse/summary`. Fixture fallback preserves local development and test determinism, but it is never reported as live mode.

The current live catalog shape is `{ version, generated_at, base_url, provider_count, affiliate_count, aggregator_count, providers }`. Provider fields include `fqn`, `title`, `description`, `use_case`, `category`, `service_url`, `endpoint_count`, `has_metering`, `has_free_tier`, `min_price_usd`, `max_price_usd`, and `sha`. Radar maps those fields into the existing provider, trust, signal, route recommendation, pulse, and event-spine models.

Live catalog endpoint counts are treated as provider-level catalog facts. If the catalog only supplies `endpoint_count`, Radar does not invent endpoint URLs, paths, methods, latency, receipts, payment success, usage volume, or per-call activity. Endpoint rows remain available only when actual endpoint details are provided by the source.

This is live catalog intelligence, not global Pay.sh transaction telemetry. Per-call Pay.sh telemetry requires official telemetry APIs, provider receipts, or routing calls through Infopunks.

Legacy accepted fixture/dev catalog shapes are an array, `{ "data": [...] }`, `{ "providers": [...] }`, or `{ "catalog": [...] }`. Known fields are provider name, namespace, slug, category, endpoint count, price, status, description, tags, optional manifest, optional schema, and optional endpoint details. Unknown telemetry is not inferred; path, method, latency, schemas, and prices stay `null` or `unknown` unless the catalog provides them.

Ingestion is idempotent. Re-running the same catalog updates `lastSeenAt` in the registry but does not duplicate events. Live provider diffs use `fqn` as stable identity, `sha` as the primary metadata fingerprint, and field-level comparisons for title, description, use case, category, service URL, endpoint count, pricing, metering, and free-tier state. New providers, catalog updates, removals, and diffs emit:

- `catalog.ingested`
- `provider.discovered`
- `provider.updated`
- `provider.removed_from_catalog`
- `price.changed`
- `category.changed`
- `endpoint_count.changed`
- `metadata.changed`
- `manifest.updated`
- `endpoint.updated`
- `schema.changed`

Every run records:

- `startedAt`
- `finishedAt`
- `source`
- `status`
- `discoveredCount`
- `changedCount`
- `errorCount`

Manual ingestion is admin-only:

```bash
INFOPUNKS_ADMIN_TOKEN=local-admin npm run dev
curl -s -X POST http://localhost:8787/v1/ingest/pay-sh \
  -H 'authorization: Bearer local-admin' \
  -H 'content-type: application/json' \
  -d '{}'
```

To override the configured source for a single admin run:

```bash
curl -s -X POST http://localhost:8787/v1/ingest/pay-sh \
  -H 'authorization: Bearer local-admin' \
  -H 'content-type: application/json' \
  -d '{"catalogUrl":"https://pay.sh/api/catalog"}'
```

Scheduled ingestion is enabled with an interval in milliseconds:

```bash
PAY_SH_CATALOG_URL=https://pay.sh/api/catalog \
PAY_SH_INGEST_INTERVAL_MS=300000 \
INFOPUNKS_ADMIN_TOKEN=local-admin \
npm run dev
```

Recent events are available at:

```bash
curl -s http://localhost:8787/v1/events/recent
```

## Safe Metadata Monitoring

Radar can collect operational telemetry without executing payable Pay.sh API calls. Scheduled monitoring is disabled by default:

```bash
MONITOR_ENABLED=false
MONITOR_MODE=disabled
```

Enable safe metadata monitoring with:

```bash
MONITOR_ENABLED=true
MONITOR_MODE=safe_metadata
MONITOR_INTERVAL_MS=900000
MONITOR_TIMEOUT_MS=5000
MONITOR_MAX_PROVIDERS=100
```

Safe metadata mode checks provider `service_url` reachability only. It sends a `HEAD` request first and falls back to a no-body `GET` when `HEAD` is not supported. Requests use a short timeout, a small redirect limit, and `User-Agent: InfopunksPayShRadar/0.1`.

Safe metadata mode does not:

- call endpoint operation paths
- append endpoint paths to `service_url`
- send Pay.sh payment headers
- send auth headers
- validate paid API responses
- prove endpoint/payment reliability

Reserved future modes are:

```bash
MONITOR_MODE=endpoint_health
MONITOR_MODE=paid_execution_probe
```

Guardrails:

- invalid URLs are skipped
- non-HTTP(S) URLs are skipped
- localhost, loopback, private, link-local, and private DNS targets are skipped
- URLs that look like paid operation paths are skipped
- skipped providers record a reason on the monitor run
- the production interval recommendation is 15 minutes

Every check records canonical `InfopunksEvent` evidence:

- `provider.checked`
- `provider.reachable`
- `provider.degraded`
- `provider.failed`
- `provider.recovered`

Monitor payload evidence includes:

- `provider_id`
- `service_url`
- `checked_at`
- `success`
- `status_code`
- `response_time_ms`
- `error_message`
- `monitor_mode`
- `check_type: service_url_reachability`
- `safe_mode: true`

Trust scoring uses safe metadata evidence for service reachability, latency, and freshness only. Receipt reliability, response validity, and paid execution success remain unknown until real endpoint or receipt evidence exists.

Every monitor run records `startedAt`, `finishedAt`, `source`, `status`, `mode`, `checkedCount`, `reachableCount`, `degradedCount`, `failedCount`, `skippedCount`, `errorCount`, and skipped reasons.

Manual monitor runs are admin-only:

```bash
INFOPUNKS_ADMIN_TOKEN=local-admin npm run dev
curl -s -X POST http://localhost:8787/v1/monitor/run \
  -H 'authorization: Bearer local-admin'
```

Recent runs and endpoint monitor evidence:

```bash
curl -s http://localhost:8787/v1/monitor/runs/recent
curl -s http://localhost:8787/v1/providers/stableenrich/monitor
curl -s http://localhost:8787/v1/endpoints/stableenrich-endpoint-1/monitor
```

Scheduled monitor example:

```bash
MONITOR_ENABLED=true \
MONITOR_MODE=safe_metadata \
MONITOR_INTERVAL_MS=900000 \
MONITOR_TIMEOUT_MS=5000 \
MONITOR_MAX_PROVIDERS=100 \
INFOPUNKS_ADMIN_TOKEN=local-admin \
npm run dev
```

Smoke commands:

```bash
INFOPUNKS_ADMIN_TOKEN=local-admin npm run dev
curl -s -X POST http://localhost:8787/v1/monitor/run \
  -H 'authorization: Bearer local-admin'
curl -s http://localhost:8787/v1/monitor/runs/recent
curl -s http://localhost:8787/v1/pulse/summary
```

The honest limitation is that a reachable provider homepage or health-like metadata URL is only service reachability evidence. It is not evidence that a paid Pay.sh operation works, returns a valid schema, or would produce a successful payment receipt.

## Provider Intelligence Pages

Provider intelligence pages are backed by the canonical `InfopunksEvent` spine. No duplicate history tables are created: provider and endpoint timelines are derived from discovery events plus diff events such as `manifest.updated`, `endpoint.updated`, `price.changed`, and `schema.changed`.

The provider intelligence summary includes:

- `latest_trust_score`
- `latest_signal_score`
- `risk_level`
- `coordination_eligible`
- `unknown_telemetry`
- `recent_changes`
- `endpoint_count`
- `endpoint_health`
- `category_tags`
- `last_seen_at`

Unavailable trust, signal, and telemetry values remain `null` or listed as unknowns. The frontend provider page shows overview metadata, trust and signal assessments, unknown telemetry, endpoint health, last checked time, latency, recent failures, endpoint inventory, recent changes, and a route recommendation CTA that keeps payment execution delegated to Pay.sh.

Smoke the new routes locally:

```bash
curl -s http://localhost:8787/v1/providers/stableenrich/history
curl -s http://localhost:8787/v1/providers/stableenrich/intelligence
curl -s http://localhost:8787/v1/endpoints/stableenrich-endpoint-1/history
curl -s http://localhost:8787/v1/endpoints/stableenrich-endpoint-1/monitor
```

## Postgres Persistence

Set `DATABASE_URL` to enable Postgres persistence:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/infopunks npm run dev
```

The app creates:

- `infopunks_events`
- `ingestion_runs`
- `monitor_runs`
- `intelligence_snapshots`

Without `DATABASE_URL`, it uses the in-memory repository for fast local iteration and tests.

## Run

```bash
npm install
npm run dev
```

API listens on `8787`. Vite frontend listens on `5173` and proxies API routes to the backend.

For a production-style local run:

```bash
npm run build
NODE_ENV=production PORT=8787 INFOPUNKS_ADMIN_TOKEN=local-admin npm start
```

## Deployment

### Required and Optional Environment

| Env | Required | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | Production only | `8787` in local dev | Render provides this automatically. |
| `DATABASE_URL` | No | unset | Enables Postgres persistence; unset uses memory mode. |
| `INFOPUNKS_ADMIN_TOKEN` | Production only | unset | Required for admin ingestion and monitor routes. |
| `PAY_SH_CATALOG_URL` | No | bundled fixture | Live Pay.sh catalog source. |
| `PAY_SH_INGEST_INTERVAL_MS` | No | disabled | Positive integer enables scheduled ingestion. |
| `MONITOR_ENABLED` | No | `false` | Set `true` to schedule monitor runs. |
| `MONITOR_MODE` | No | `disabled`, or `safe_metadata` when legacy `MONITOR_ENABLED=true` is set | Supported: `disabled`, `safe_metadata`. Reserved: `endpoint_health`, `paid_execution_probe`. |
| `MONITOR_INTERVAL_MS` | No | `900000` | Monitor schedule interval when enabled. |
| `MONITOR_TIMEOUT_MS` | No | `5000` | Per-check timeout. |
| `MONITOR_MAX_PROVIDERS` | No | `100` | Maximum providers checked per safe metadata run. |
| `FRONTEND_ORIGIN` | No | local dev open CORS | Set to the deployed frontend origin, for example `https://radar.example.com`. |
| `VITE_API_BASE_URL` | Frontend deploy only | relative paths | Set to the deployed backend URL when frontend and backend are hosted separately. |

Production startup validates `PORT`, URL-shaped envs, boolean envs, positive integer interval envs, and `INFOPUNKS_ADMIN_TOKEN`.

Startup logs are structured JSON and include API port, monitor enabled, ingestion enabled, DB mode, and catalog source.

### Render Backend

- Runtime: Node 20+
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Required production env:

```bash
NODE_ENV=production
INFOPUNKS_ADMIN_TOKEN=<strong-token>
```

Render supplies `PORT`. Set `DATABASE_URL` to a Render Postgres connection string when persistent storage is needed. Set `FRONTEND_ORIGIN` to the deployed frontend domain to restrict browser CORS.

### Frontend Build

The frontend builds to `dist/client`:

```bash
VITE_API_BASE_URL=https://your-backend.onrender.com npm run build
```

If the frontend is served from the same origin as the backend, leave `VITE_API_BASE_URL` unset so API calls use relative paths.

### Docker

Build and run:

```bash
docker build -t infopunks-pay-sh-radar .
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e PORT=8787 \
  -e INFOPUNKS_ADMIN_TOKEN=local-admin \
  infopunks-pay-sh-radar
```

### Deployment Checklist

- `npm test`
- `npm run typecheck`
- `npm run build`
- Confirm `NODE_ENV=production` is set on the backend.
- Confirm `INFOPUNKS_ADMIN_TOKEN` is set on the backend.
- Confirm `FRONTEND_ORIGIN` matches the exact frontend origin when frontend/backend are separate.
- Confirm `VITE_API_BASE_URL` matches the backend origin when building a separate frontend.
- Confirm `DATABASE_URL` is set if deployment needs durable state.
- Confirm scheduled ingestion and monitoring are intentionally enabled or disabled.
- Run deployed backend smoke checks:

```bash
BACKEND_URL=https://your-backend.onrender.com npm run smoke:backend
```

## Validate

```bash
npm test
npm run typecheck
npm run build
```

## Local Smoke Commands

```bash
npm test
npm run typecheck
INFOPUNKS_ADMIN_TOKEN=local-admin npm run dev
curl -s http://localhost:8787/health
curl -s http://localhost:8787/v1/events/recent
curl -s http://localhost:8787/v1/providers/stableenrich/history
curl -s http://localhost:8787/v1/providers/stableenrich/intelligence
curl -s http://localhost:8787/v1/endpoints/stableenrich-endpoint-1/history
curl -s http://localhost:8787/v1/monitor/runs/recent
curl -s http://localhost:8787/v1/endpoints/stableenrich-endpoint-1/monitor
curl -s -X POST http://localhost:8787/v1/ingest/pay-sh -H 'authorization: Bearer local-admin' -H 'content-type: application/json' -d '{}'
curl -s -X POST http://localhost:8787/v1/monitor/run -H 'authorization: Bearer local-admin'
```
