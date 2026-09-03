# //4663 Front Door contract

This rule is frozen before Phase 3:

> **GLOBAL FRONT DOOR STATE ≠ USER STATE**

## Global front door

`GET /v1/4663/frontdoor` is a public, anonymous, shared-cacheable read model. Its body is identical for every caller and is derived only from global Robinhood Chain state and latest persisted public reads:

- NOW
- WATCH
- OPEN LOOPS
- the current global Pulse window and consensus state
- global source health and provenance

The route does not read cookies, authorization, wallet identity, account identity, or user preferences. It remains safe behind a CDN/shared cache and uses the monotonic `ETag: "frontdoor-N"` namespace.

The `current_call` field means the global Pulse window/consensus snapshot. It is not the caller's CALL. Likewise, `proof_summary` is global window context and an explanation of where personal proof appears; it is not a wallet receipt or personal accuracy record.

## User overlay

User-scoped state belongs under `/v1/4663/me/*` and must not be added to the shared response:

- MY CALL
- wallet-specific receipts
- personal accuracy
- MY 4663 follows
- private account state
- MY CHANGES or other identity-derived overlays

The React client composes this small private overlay over the cached global page. User endpoints must use user-scoped authorization and `Cache-Control: private, no-store` (or an equivalent non-shared policy).

## Version durability

`frontdoor_version_durability` is explicit in the global response:

- `PERSISTENT`: the counter is backed by the Postgres singleton table.
- `EPHEMERAL`: development/test process-local fallback only.

Production requires `DATABASE_URL` for this route's version counter. A configured Postgres adapter is not allowed to fall back to memory in production; if durable version storage is unavailable, the route fails closed with `503 frontdoor_version_durability_required` instead of publishing a potentially colliding shared ETag. Local development and tests may use `EPHEMERAL`.
