# 4663 stored market intelligence contract

Scope: the category extension and its shared Front Door integration. This documents existing behavior owners; it does not claim to reconcile every legacy Radar workflow. Visual intent lives in [DESIGN.md](DESIGN.md).

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Scrollbar | src/web/styles.css | Global application stylesheet | Existing document scrolling | Browser computed style |

Category disclosure uses native details/summary. Navigation uses ResearchLink/native anchors; new evidence links do not initiate transactions or payment. No table selection, select, form, date picker, toast or CRUD is introduced by this extension.

## Public reads and recovery

Global Front Door data is independent of wallet headers, cookies, follows and private CALLs. The category projection reads the existing durable observation store and publicly reviewed identity records. It has no collector, publication or judgment dependency. `/v1/4663/market/categories` is a current no-store read; `/v1/4663/frontdoor` retains its shared version/ETag contract.

Initial read shows loading. Successful reads expose exact identity, source and observed time. A refresh failure keeps the last successful body and reports degraded refresh; it never advances evidence time. Visible tabs poll conditionally every 15 seconds, with a four-second request deadline. Hidden tabs pause; resume reads immediately; overlapping requests coalesce. Unmount cancels the read. Expired rows leave current category views and remain accessible through history.

Five lanes remain visible: Stock Tokens, RWA/DeFi, Memes, Stables and market discovery. Only exact-contract official registry or reviewed category records assign a category; conflicts and unknown identity remain unclassified. Category input coverage does not imply reviewed quality, safety or execution authority. Stock/RWA/stable financial scoring is withheld until specialized inputs exist; meme activity scoring requires explicit paid-attention coverage for the entire same-pair window.

## Accessibility and state coverage

Native disclosure keyboard behavior, text status, visible focus, wrapping contracts and one-column mobile layout are required. English UI, explicit UTC timestamps, reduced-motion inheritance. No hover-only evidence. Test empty categories, failed providers/storage, stale snapshots and identity conflicts alongside populated views. CALL, canonical resolution, receipt authority and private proof remain unchanged.

## Daily intelligence and recorded returns

`AUTOMATED_OBSERVATION_RECEIPT` is an immutable fact record in its own store. It has a separate default-off activation gate and public projection. The compact Front Door card consumes published editions only; the evidence route carries their full commitments and additive correction references. Source outages cannot reset observation time. No card authorizes execution or changes CALL/RESOLUTION semantics.

The global version and event journal commit atomically. Persisted questions retain their opening time; missing current evidence marks unresolved questions stale. Countdown text does not advance the version. Private follow cursors match exact question identities and stay outside shared responses. View telemetry requires visible viewport intersection. Revalidation cannot establish a new visit. Return copy describes recent changes since a recorded view; the bounded event history is not a guarantee of complete history for every old cursor. See `docs/rh4663-frontdoor-contract.md` for privacy and cache ownership and the current RH-PIPELINE-1C/1D task for publication authority.
