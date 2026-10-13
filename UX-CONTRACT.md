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
