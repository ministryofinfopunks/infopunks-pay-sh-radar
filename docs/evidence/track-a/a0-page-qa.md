# A0 local application surface QA

**Environment:** frozen SHA `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`; production build served at `http://127.0.0.1:8787`, `NODE_ENV=development`, no credentials, memory persistence, fixture catalog. Real Chromium (Playwright) visited each path at 1440×1000 and 390×844; screenshots and captured body text/errors are in `output/track-a/a0/`. No interaction triggered any external paid service.

## Route results

| Path | Document result | Browser/API findings | Data interpretation |
| --- | --- | --- | --- |
| `/` | 200 desktop/mobile | No browser console/page errors or failed resources. | Fixture catalog and memory-backed displays; not production evidence. |
| `/spend-terminal` | 200 desktop/mobile | No browser console/page errors or failed resources. | Seeded routes/providers may appear; do not treat as live offer/evidence. |
| `/routes` | 200 desktop/mobile | No browser console/page errors or failed resources. | In-memory fixture route catalog. |
| `/providers` | 200 desktop/mobile | No browser console/page errors or failed resources. | In-memory fixture provider catalog. |
| `/receipts` | 200 desktop/mobile | No browser console/page errors or failed resources. | Demo/community/seed receipts are not canonical production receipts. |
| `/loops` | 200 desktop/mobile | No browser console/page errors or failed resources. The rendered page is LoopLab despite generic document title. | Screenshot visibly includes six seeded loop cards and status counts. UI demonstration only; zero qualifying production loops. |
| `/4663` | 200 desktop/mobile | No browser console/page errors or failed resources. | Local page rendered; production source freshness and database-backed receipt completeness unverified. |
| `/4663/reflexive` | 200 desktop/mobile | `GET /v1/4663/reflexive/audits/long-ai-nvda` returned HTTP 409 in both viewports; browser reports failed-resource console error. Snapshot rendered with fail-closed unavailable/zero evidence states. | Conflict is surfaced as an API failure; no qualifying mission pair was reported. The reason for 409 was not established as a production condition. |
| `/ipx/economy` | 200 desktop/mobile | `GET /v1/ipx/genesis/cohort`, `/v1/ipx/economy/receipts`, `/v1/ipx/economy/summary` each returned HTTP 503 in both viewports. | Expected local missing-storage behavior; page says durable economic evidence unavailable. Launch terms/deployment pending. Database-dependent. |
| `/openapi.json` | 200 desktop/mobile | No browser console/page errors or failed resources. | OpenAPI JSON response was returned; browser displays raw JSON. |

The 20 document navigations succeeded. No uncaught JavaScript exceptions were recorded. Mobile layout probes reported no document-level horizontal overflow at 390 px on the nine HTML paths. The screenshot run found no 4xx/5xx static document requests; the `/4663/reflexive` 409 and three `/ipx/economy` 503 responses are API calls, not document-load failures. The `/4663/reflexive` 409 needs triage before representing the audit panel as operational; this QA run did not determine whether the conflict is expected or erroneous. The three economy endpoints correctly withhold data when durable storage is absent, but mean that local readiness is not a launch attestation.

Fixture and staleness: the local server explicitly reported `catalogSource=fixture`, memory persistence, and no DB. Its LoopLab cards are seeded sample records. Their displayed scores, counts, and statuses are not genuine provider work, payments, verified outcomes, or learning. No production request was made, so production freshness, missing-data rates, navigation, and browser errors remain unverified.

## Captures and raw evidence

- `output/track-a/a0/screenshots/`: desktop/mobile PNG for every requested path.
- `output/track-a/a0/page-browser-results.json`: page title, visible body text, document status, console errors, and failed responses per viewport/path.
- `output/track-a/a0/logs/page-browser.log`: concise browser run output.
- `output/track-a/a0/logs/server.log`: local server startup and development readiness record.
- `output/track-a/a0/logs/smoke-backend.log` and `smoke-production.log`: localhost smoke evidence.
