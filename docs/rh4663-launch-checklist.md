# //4663 launch readiness checklist

This checklist is operational only. It cannot approve evidence, change a CALL,
or override Preflight.

- [ ] Durable database is available; campaign history and frontdoor version are persistent.
- [ ] `/v1/4663/frontdoor` is healthy, cacheable, and ETag revalidation works.
- [ ] `RH_4663_CAMPAIGN_MODE_ENABLED` is intentionally set for the environment.
- [ ] `RH_4663_CAMPAIGN_REHEARSAL_ENABLED` remains off in production except during a protected reviewer rehearsal.
- [ ] Canonical source health, freshness, source links, Open Loop, CALL window, shares, and OG routes pass the campaign readiness report.
- [ ] CALL creation, signature verification, receipt re-read, resolution, and proof pages work unchanged.
- [ ] Campaign hero is checked on mobile, keyboard navigation, and normal NOW remains directly reachable.
- [ ] MY 4663 remains private/local-first; no campaign payload contains personal state.
- [ ] Reviewer authentication, rollback (cancel campaign / disable flag), and normal-mode fallback are tested.
- [ ] Local or staging load rehearsal covers frontdoor, ETag, campaign landing, immutable OG, and resolution burst. Do not represent local results as production SLOs.
- [ ] Run `GET /internal/4663/campaigns/:id/readiness` before activation. Blockers are not manually overridden.

Product Intelligence is internal-only and advisory. Notification work remains
blocked until organic resolution-return and Open Loop-return coverage is enough
to support a separate decision.

## Product Intelligence and notification gate

- Product Intelligence persists only bounded categorical event primitives for
  90 days. Apply migration `20260908_010_rh4663_product_intelligence.up.sql`
  before production deployment. It never stores a wallet address, signature,
  balance, holdings, private draft, raw event payload, or follow-list contents.
- Connected identities are one-way, service-local pseudonyms used only to link
  a canonical CALL, its published RESOLUTION, and a meaningful return. Anonymous
  events remain aggregate-only; they are never fingerprinted.
- Resolution Return Rate is `unique linked resolution returners / unique
  identities with a resolved CALL`. Second Call Rate is `linked returners with
  a later valid CALL / linked returners`. Missing linkage is `INSUFFICIENT_DATA`,
  never 0%.
- D1, D7, and D30 apply only to meaningful return actions: resolution view,
  later CALL, Open Loop revisit, followed-change view, or proof view after a
  resolution. Reloads, background fetches, OG requests, and analytics requests
  are excluded.
- The advisory notification gate may report `INSUFFICIENT_EVIDENCE`,
  `READY_FOR_NOTIFICATION_EXPERIMENT`, or `DO_NOT_ADD_NOTIFICATIONS`; it never
  enables an outbound channel. Review observed rates, sample sizes, coverage,
  and trend in the internal Product Intelligence endpoint before a separately
  authorized notification decision.

## Observation-window freeze

After the durable baseline deploys, freeze feature work for a real observation
window. Record that deployment timestamp as `PRODUCT OBSERVATION T0`. Keep
Product Intelligence at `INSUFFICIENT_DATA` until its denominators exist; do
not use that state to justify a new notification channel. Review directional
D1 signal, useful D7 behavior, then D30 behavior. Review, in order: Resolution
Return Rate, Second Call Rate, Open Loop follow-to-return, Share → Evidence
Open, MY 4663 followed-change return, and campaign versus normal entry.
Rehearse one existing non-economic evidence story before any public campaign;
IPX is excluded.

## Railway infrastructure parity gate

- [ ] Separate Railway PostgreSQL provisioned; source backup and target restore verified.
- [ ] Write freeze/final synchronization and rollback reconciliation rehearsed.
- [ ] Existing additive migrations applied only where pending; migration-status gate passes.
- [ ] Same reviewed API commit deployed using the existing Dockerfile and ordinary bindings.
- [ ] Production live/HTTPS/no-fallback/database invariants pass runtime verification.
- [ ] Admin/reviewer/signing/RPC settings retained for enabled capabilities.
- [ ] `/healthz` and `/readyz` return 200; staging outages produce readiness 503 only.
- [ ] API parity smoke tests pass against the target; public response shapes unchanged.
- [ ] Receipt integrity, persistence after restart, and any JSONL volume are verified.
- [ ] Live catalog provenance/freshness verified; no fixtures on catalog failure.
- [ ] Traffic/DNS changes occur only after all preceding gates; duplicate workers prevented.
- [ ] Prior host/commit and backup retained; rollback and target-write reconciliation documented.
- [ ] Actual deployment/migration/cutover recorded separately from configuration preparation.
- [ ] No Phase 1 receipt-schema or protocol changes included.

Follow the ordered Railway procedure in `docs/rh4663-production-runbook.md`.

## Phase 1 receipt authority gate

- [ ] Phase 0 gates passed independently; production live catalog and PostgreSQL readiness verified.
- [ ] External migration `20261007_011_canonical_receipt_spine.up.sql` applied to the deployment database after backup.
- [ ] Four receipt tables, normalized observation membership, parent FKs and immutable triggers verified under the application role.
- [ ] Authenticated append/read/restart/replay smoke confirms only EvaluationReceipt changes canonical score.
- [ ] Nonzero legacy confidence delta rejected; community claim/validation/Proof Check/Loop Check intake retained without reputation authority.
- [ ] Typecheck, lint, unit/integration tests, build and diff checks pass; dedicated PostgreSQL tests executed.
- [ ] Rollback preserves append-only memory. No automatic legacy backfill or Phase 2 work.
