# Radar observable behavior contract

Visual identity and runtime ownership are in [DESIGN.md](DESIGN.md) and the existing [constitution](docs/design-system/constitution.md).

## Business sources

| Rule | Authoritative source |
| --- | --- |
| Private judgments and receipt ancestry require tenant and agent ownership | `src/security/judgmentAuth.ts`, receipt-spine API owner guards, user Phase 1 authorization |
| A Decision View is read-only and cannot authorize execution | `src/schemas/decisionView.ts`, `execution.authorized=false` |
| Share surfaces expose public projections only | `src/services/rh4663ShareObjectService.ts`, `src/web/publicShareSchema.ts` |
| Receipt hashes, signatures, and ancestry require canonical validation | `src/schemas/receipts/`, canonical receipt API |
| No payment/signing/execution activation | User Phase 1 authorization; runtime release gate |

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | `TenantKeyField`, `FieldFeedback`, canonical schemas | Existing constitution and canonical API contracts | Explicit credential submission; memory-only reveal | QA2 and private Decision View component/browser tests |
| Select/Listbox | Existing native select | Existing constitution and canonical API contracts | Platform-owned popup | Existing UX tests; real-device gate HOLD |
| Scrollbar | `radarDesignSystem.css` application baseline | Existing constitution and canonical API contracts | Local table/JSON geometry | Browser viewport checks |
| Feedback | `RadarAsyncState`, `FieldFeedback` | Existing constitution and canonical API contracts | Inline error/live state; no transient toast for critical errors | QA2 recovery assertions |
| Navigation | `RadarAppShell`, existing route family dispatchers | Existing constitution and canonical API contracts | Local reader recovery preserves owning network | Share recovery/browser checks |
| Receipt detail | `CanonicalReceiptPage` | Existing constitution and canonical API contracts | Parent links start independently authenticated inspection | Existing receipt inspection tests |

## Flow ledger

| Operation | Trigger/pending | Success | Failure/recovery |
| --- | --- | --- | --- |
| Semantic search | Explicit submit; no request during IME composition; stale generation ignored | Valid response array only; empty valid array yields no results | Invalid envelope/item yields Search could not complete; retry or clear; draft retained |
| Public share | Read-only owning-family GET | Complete PUBLIC/versioned projection only | Invalid URI encoding stays in Robinhood local recovery; invalid payload is not rendered and emits no telemetry; GET retry available |
| Private receipt | Explicit masked key submit; prevent duplicate requests | Canonical schema-validated receipt; parent access remains independently authenticated | 401 describes correction and focuses re-enabled key; 403/404 share generic denial; no payload echo |
| Private Decision View | Explicit Judgment ID and key submit; no anonymous mount request | Exact schema and requested Judgment identity; original receipt opens canonical inspector | Missing/wrong identity denied generically; stale/malformed records cleared; memory-only credentials |

Semantic draft search is transient by the existing constitution, with no URL persistence or unsolicited debounce. Committed route service/sort filters retain validated URL state. No new CRUD lifecycle or destructive action is introduced.

## Release evidence

All eight historical QA2 assertions remain mandatory under `tests/ux-qa2-acceptance.test.tsx`. Test placement and fixture path change only. Automated browser checks complement the probes; incomplete assistive technology, physical-device, human visual review, and native zoom checks remain HOLD.

## R1 bounded read recovery

Unicorn reads validate existing response schemas before rendering. Market observation time denotes provider capture (including cache reuse), never repeated-request time. Unavailable optional orders counts remain unknown. Machine release readers treat unusable required receipt envelopes as unavailable evidence and expose a read-only retry, rather than inventing zero proof. Existing root protocol sections align and receive focus after lazy mount/hash navigation. No backend authority or receipt policy is changed.

## R2 read reference corrections

Full valid-shaped summaries require internally consistent counts; invalid responses remain unavailable with existing retry. Capture time labels identify Radar cache insertion rather than inventing provider publication time. Source-note dates and verification scope remain separate. Catalogue labels express proposed scope/HOLD and exclusions, not backend authorization. Legacy methodology resolves to proof with focus; legacy agent benchmark navigation preserves Solana context. Public route-control policy remains subject to the explicit separate authorization in user R2section1.2.
