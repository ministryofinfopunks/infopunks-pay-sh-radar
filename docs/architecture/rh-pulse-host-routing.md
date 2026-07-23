# ADR: RH Pulse host-aware routing in the Radar application

- Status: accepted for Phase 1
- Date: 2026-07-23
- Decision owners: Infopunks

## Context

RH Pulse needs an independent public front door at `pulse.infopunks.fun`, fallback access at `/rh-pulse`, shared Radar data/services, Pulse-specific metadata, and no regression to the established Radar routes. A second frontend build or framework would duplicate boot, API, deployment, and RH Chain integration behavior.

## Decision

Keep one Fastify server, one Vite client build, and one React entry.

`src/shared/rhPulseRouting.ts` is the shared routing authority used by:

- the Fastify SPA metadata path;
- the React entry surface dispatch;
- the pre-React boot label;
- route and security tests.

The server classifies a request as Pulse when either:

1. the trusted effective hostname equals configured `PULSE_PUBLIC_HOST`; or
2. the normalized path is `/rh-pulse` or starts with `/rh-pulse/`.

On the Pulse hostname, `/` is Pulse home. On every other host, `/` remains Radar. The Pulse router recognizes home, methodology, call, and receipt paths. Phase 1 call/receipt paths are reserved shells only.

The server injects Pulse title, description, canonical, Open Graph, Twitter, theme color, JSON-LD, and a serialized boot context into the shared HTML shell. The browser reapplies the same metadata after client navigation. Pulse removes Radar share-image metadata because Phase 1 has no approved Pulse share card.

## Host trust and canonical safety

`PULSE_PUBLIC_HOST` is parsed as a hostname without a scheme, credentials, path, comma list, or port. It defaults to `pulse.infopunks.fun`.

The direct `Host` header is normalized before comparison. `X-Forwarded-Host` is considered only when the direct host is one of the known Render service hosts. A public Pulse or Radar custom domain remains authoritative even if a client supplies a conflicting forwarded-host header. Multi-value or malformed headers fail closed.

Canonical and structured-data URLs always use `PULSE_PUBLIC_HOST`. An unknown request host can reach the explicit `/rh-pulse` fallback, but it cannot change canonical identity. Unknown hosts at `/` retain the generic Radar shell.

## Consequences

Benefits:

- one deployable artifact and one backend;
- no duplicated RH Chain ingestion or provider reads;
- Pulse hostname and fallback path behave consistently;
- existing Radar routing and metadata stay in their established path;
- hostname rules are pure and unit-testable.

Tradeoffs:

- server and client must share a small serialized Pulse boot context;
- root `index.html` responses must pass through metadata injection rather than raw file streaming;
- production proxy/domain changes require updating the trusted deployment-host list if the underlying Render hostname changes.

## Rejected alternatives

- A second Vite application: duplicates boot, bundles, infrastructure, and route behavior.
- Client-only hostname detection: sends incorrect canonical/OG metadata to crawlers.
- Canonical URLs derived from request headers: permits host-header poisoning.
- A parallel RH Pulse data backend: violates the shared-engine and shared-Postgres boundary.

## Operational requirement

Attach both `radar.infopunks.fun` and `pulse.infopunks.fun` to the same Render Web Service. Keep `PULSE_PUBLIC_HOST=pulse.infopunks.fun`. Keep `RH_PULSE_CALLS_ENABLED=false` through Phase 1.
