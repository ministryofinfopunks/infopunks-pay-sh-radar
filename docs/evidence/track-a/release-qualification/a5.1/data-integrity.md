# A5.1 Reflexive asset and pricing defect report

## Reflexive Radar 409

The route `/v1/4663/reflexive/audits/long-ai-nvda` requires an available RPC verifier and finds NVDA in the persisted canonical asset snapshot. When no canonical snapshot has been refreshed, it returns `409 long_audit_canonical_registry_not_refreshed`. The page's shared `useResource` hook captured the response error, but the home page rendered the AI/NVDA panel only on success and had no error state. This made the real unverified state look like missing content.

The active upstream RHJ assets endpoint was available during investigation and returned the canonical active NVDA registration (`0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`, chain 4663). The observed local 409 is therefore an incomplete local initial refresh, not evidence that registration is missing or that upstream was unavailable. The route correctly remains fail-closed and was not changed to infer or manufacture market state.

Repair: render an explicit AI/NVDA audit unavailable state, preserving the API error and explaining that canonical refresh is required and no market state is inferred. `tests/reflexive-radar-page.test.tsx` verifies that a 409 reaches the visible page. Staging still needs an authenticated operator refresh and a successful, persisted snapshot before this audit can be qualified.

## Pricing payload warning

The source was the route decision card: it passed `routeResult.estimatedCost` (a route estimate with runtime values not guaranteed to be the catalog `Pricing` object) into `formatPrice`, then labeled the result “catalog range”. The formatter warned on non-object shapes. This mixed route estimates with catalog evidence and could imply a quote.

Repair: the decision card now formats only `bestProvider.pricing`, and labels it as a catalog range with an explicit note that route estimates are not catalog quotes. The shared formatter accepts only finite, nonnegative, ordered numeric ranges or explicit USD price strings. Unsupported input, invalid ranges, negative values, an implicit zero range, and arbitrary text display as `unknown`; only explicit `free` evidence displays as free. Existing source/timestamp/provenance data remains attached to the payload and is not rewritten by formatting. `tests/pricing-display.test.ts` covers supported and rejected shapes.
