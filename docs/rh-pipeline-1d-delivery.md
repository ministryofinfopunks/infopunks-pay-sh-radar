# RH-PIPELINE-1D — public evidence and return loop

**Code and local PostgreSQL integration: PASS. Staging and production: HOLD.** This is an independent report scope on the combined candidate, not an external-review certification.

## Qualified source and ledger

Qualified combined source: `d6ee38f45f512957f53a8a27d30cbdf3cf337c9c`. 1D implementation: `ee461ba62ee45824bd2339a52b51c94f669a5420`, directly after 1C `f5713126b340faba437dfd0df34a375a46844d9b`. The final commit canonicalizes receipt JSON keys without host locale dependence. Branch: `codex/rh-daily-return-integration`. All original worktrees and refs are retained. The qualified baseline report pins the earlier ancestry.

`evidence/rh-pipeline-1d/qualification.json` lists every 1D changed file. `candidate-ledger.json` pins combined ancestry, changed files, all migration hashes, default-off gates and protected unchanged authority files. Main runtime changes are in frontdoor/global versioning, persisted open loops, private My4663 matching, API wiring and the direct 4663 UI route. Asset-only portrait provenance is in `portrait-provenance.json`; no application code from the portrait source branch was merged.

## Public journey

NOW retains the qualified Category projection over stored eligible observations and published Signals. It adds a compact, source-linked published prior-day factual edition, sample endpoints, explicit unavailable data and coverage gaps. No edition appears until separately published. Freshness uses actual observed timestamps with relative age and accessible absolute UTC labels.

WATCH shows developments, risk cues, evidence state, freshness and source links. An anomaly remains an observation, not an allegation or safety verdict. OPEN LOOPS persist opening/meaningful-change times and unresolved questions, requirements, confirmation/falsification conditions and checkpoints. Resolved category input coverage is labeled as input coverage, with no reviewed-judgment implication. Missing sources mark retained unresolved loops stale rather than silently removing them.

CALL explains that qualified event significance determines the rotation outcome, rather than total investment return. Signed calls, frozen resolution rules, inclusion proofs, personal histories, canonical judgments, reputation and IPX economic mechanisms remain unchanged. The ledger verifies protected source files byte-for-byte against the integrated baseline; regression cases exercise the existing invariants.

## Durable returns and privacy

Migration `20261013_026_rh_frontdoor_return_state` formalizes existing global version/event tables and adds durable open-loop state. Together with migration 025, final qualification applies all 20 migrations. PostgreSQL advisory locking and one transaction commit a semantic version with its source-linked events. Injected event-write failure rolls back the version; retries and restarts preserve the journal. In-flight reads coalesce. Meaningful loop transitions receive exact loop references. Countdown ticks do not spam versions.

Global change history uses the existing authorized private overlay for follows and recorded cursors. Invalid/future cursors are rejected and a truncated retained history is identified as potentially incomplete. Exact loop follows work alongside markets; no inferred visit/view is created by polling or mounting hidden content. Visible viewport telemetry and document visibility determine a recorded view. The session keeps its original recorded cursor while displaying change summaries. Private routes remain `private, no-store` with wallet/authorization variation, separate from anonymous public state.

Public frontdoor requests read persisted sources and read models, with no RPC, DEX Screener, Blockscout or remote-provider calls. Source links are ordinary navigation, not fetches during the frontdoor request. Public ETag/version behavior and 15-second shared caching are preserved. `synthetic-api.json` demonstrates 200/304 public responses and private no-store responses; those single local timings are not operational SLO evidence. The memory-only preview is ephemeral, so its version can restart at one: screenshots used a fresh cache origin after preview restart. Production qualification requires durable version storage.

## UI, bundle and visual evidence

The cyan, portrait-led Radar direction remains in `DESIGN.md` and `UX-CONTRACT.md`. Scoped headings/statuses/scrollbars remove legacy green leakage from the ready frontdoor. Portrait dimensions reserve space at desktop/mobile breakpoints. Evidence disclosure is keyboard accessible, source timestamps have accessible labels, and reduced-motion rules suppress transitions/animations. Scoped forced-colors handling preserves system scrollbars.

Synthetic browser captures: `desktop.jpg` at 1280 × 720; `mobile-390x844.jpg`; `mobile-evidence-expanded.jpg`; `investigation.jpg` for the existing index route. DOM captures verify page width equals viewport width, portrait loaded, and coverage disclosure expands using Enter with a 3px cyan focus outline. The preview includes empty categories and degraded/stale research sources; tests additionally cover null/empty and visibility states. Screenshots are local visual regression evidence, not live mobile/network qualification or a complete accessibility certification. Staging must exercise real responses, assistive technology, contrast across all states and realistic slow/stale/degraded networks.

Route-level lazy loading is justified by the measured inherited warning. Direct 4663 routes now load their page without first loading the broad Radar router, while deep research routes retain that router. Static imported JavaScript closure before: **1,950,579 bytes / 420,850 gzip bytes**. After: **303,235 / 87,939 bytes**, reductions **84.45% / 79.10%**. Measurement excludes CSS, images, fonts and conditional wallet imports; it is not a network waterfall or LCP result. The broad Radar chunk still measures 1,294.76 kB / 247.89 kB Vite gzip and retains its >500 kB warning. See `bundle-measurement.json` and `build.log`.

Design lint: zero errors/warnings. Premium strict static audit: zero findings within the configured `src/web/marketIntelligence` scope; it does not certify the entire legacy UI. This scope limitation is explicit in `visual-qualification.json`.

## Tests, rollback and promotion blockers

Final frozen-source full suite: **2,012 passed, zero failed, zero skipped across 276 files**. Typecheck, lint and server/client builds PASS. Explicit disposable PostgreSQL 14 URLs enabled canonical, economic and resilience integrations. `tests.json` preserves individual outcomes. Transactional failure/retry, restart, stale/late data, source-linked transitions, cursor/follow matching, viewport telemetry, UTC evidence, null metrics, chain identity, deterministic scores/hashes, public/private caching and inherited CALL/RESOLUTION/judgment/economic regressions pass.

The prior resource-contention failure report remains `resource-contention-full-suite.json`; the affected endpoint/resilience files separately pass 43 cases in `contention-retest.json`, followed by the all-green combined run. No failing run is discarded or counted as a pass.

Rollback application code to the integrated baseline while leaving immutable editions, global versions/events and loop state intact. Migration 026 down refuses populated state and only removes an empty newly added loop table; it preserves the pre-existing global namespace/events. Use forward fixes once durable data exists. Keep independent scheduler/publication gates off throughout rollback. Do not reset a live version counter, rewrite receipt history or roll back signed Pulse rules.

Promotion remains HOLD. Required staging evidence includes real provider collection and historical replay, production-style PostgreSQL migration/backup rehearsal, stale/outage recovery, realistic mobile/network accessibility and measured SLOs. Missing corporate-action/verified-supply/RWA evidence blocks only conclusions requiring those inputs. No external distribution or automatic publication is enabled; production authorization remains separate. No pushes, remote merges, deployments or production configuration changes occurred.
