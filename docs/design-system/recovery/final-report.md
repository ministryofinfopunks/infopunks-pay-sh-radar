# Infopunks Radar terminal identity recovery — HOLD

Implementation is complete and reviewable on `codex/radar-terminal-identity-recovery`; no merge or deployment. The default `/` on the recovery branch uses the supplied cyan portrait terminal. The original two worktrees remain preserved. Production/main and historical previews are not silently represented as updated.

## Root cause and exact ports

Two separate branches exported `UniversalHomepage`. The earlier design-system constitution explicitly retained the green editorial manifesto when the visual reference was absent; the unified branch later implemented the cyan terminal without reconciling that universal shell. Both shared main ancestor dfe089b. Old green boot HTML also survived on the cyan branch. This was different source/build lineage, not a runtime theme switch.

| Port | Source and process | Entry / styles |
| --- | --- | --- |
| 5178 | PID 8901, Vite; `/Users/ahdilm/.codex/worktrees/radar-design-system/Infopunks Pay.sh Intelligence Terminal`; `codex/radar-design-system` at `068df2356834a97eecf8c5192b16a5036dca1a09` | Green `main.tsx → RadarAppShell → UniversalHomepage`; `homepage.css → radarTokens.css → radarDesignSystem.css`, lazy `styles.css` |
| 8799 | PID 84644, built Fastify; `/Users/ahdilm/.codex/worktrees/unified-radar/Infopunks Pay.sh Intelligence Terminal`; `codex/unified-radar` at `205e3c9` (full SHA in source-manifest.json) | Cyan `UniversalHomepage`; inspected `/assets/index-D0nnPZGN.js`, `/assets/index-DB9tUcI9.css`; source had `homepage.css → designTokens.css` plus legacy route CSS |
| 5182 | Recovery built Vite preview; `/Users/ahdilm/.codex/worktrees/radar-terminal-identity-recovery/Infopunks Pay.sh Intelligence Terminal` | Canonical shared shell; `radarTokens.css → radarDesignSystem.css → homepage.css`; lazy workflow CSS and separate primary spend entry |

The mapping above records the initial audit. After the continuation, ports 5178 and 8799 were no longer listening; their worktrees remain untouched. The recovery frontend preview was restarted at 5182. Its backend target is currently unavailable, so live API journeys are HOLD and should show error/unavailable states. The stopping cause was not determined. Recovery API reads use the existing localhost backend through preview proxy; this is local seed/compatibility evidence, not production qualification. Port attribution, before screenshots and build asset references are in root-cause.md and before-ports.json.

## Canonical constitution, components and tokens

`docs/design-system/constitution.md` is V2; the supplied PNG is preserved unchanged under `docs/design-system/references/`, with SHA256 in reference-sha256.txt. The V1 constitution/report remain historical evidence. Root AGENTS.md requires the canonical components and forbids another theme, copied global chrome or automatic baseline approval.

One `RadarAppShell` owns `ProductHeader`, five-destination `ProductWayfinding`, indexed route context, error boundary and `ProductFooter`. Existing network directories remain beneath it as progressive disclosure. Specialized controls and layouts remain intact. `RadarSectionHeader`, `RadarStatus`, `RadarReceiptLifecycle`, `RadarEvidenceRow`, `RadarAsyncState` and `RadarDataTable` remain the shared library. The homepage now consumes the same lifecycle as receipt workflows. Approved TerminalIcon and Signal Lens artwork are reused; no substitute image, external font or UI framework is introduced.

`src/web/radarTokens.css` is the sole palette architecture. Approved values: canvas #050b0c, panels #081113, raised #102024, bone #f1f0e5, muted #a0c2d0, borders #4e737d, cyan #00eee4, Judgment #dc91ff. Existing success #9dffc2, amber and error roles remain semantic. Green-named compatibility aliases now resolve to cyan for actions; verified success uses --ok. Robinhood local color variables became aliases in the same file. Removed unused --home-* aliases and the retired editorial composition. Removed decorative gradients, glow/shadow fills and backdrop blur from workflows; restrained geometry, rem type sizes and readable metadata remain. Contrast preferences are centralized.

## Routes migrated

Actual TypeScript dispatchers were scanned, including aliases and details: **129 patterns, 137 concrete routes, 979 viewport cases**. Every match inherits the shell/tokens. The full migration matrix is `../route-inventory.md`; exact patterns/source lines are `../route-patterns.json`; concrete route-by-route final results are `evidence/qualification-summary.json`.

Coverage includes homepage, Solana, Spend Terminal, pre-spend cards/check/claims, routes/providers/services and their details, receipt/proof/revenue receipt inspection, LoopLab, evaluation requests, provider and machine reputation, machine markets and dossiers, attention/signal graph/hunt, narratives, Hermes/wallet memory, Robinhood signal desk and subviews, //4663, Reflexive, IPX/PLTR, liquidity/contracts/counterparty/market evidence, developer documentation, and discovered internal review interfaces. Their workflow layouts remain distinct. This baseline has no dedicated canonical Judgment-detail dispatcher; receipt detail is captured, and the newer release baseline's canonical workflow is explicitly an integration blocker.

## Two visual checkpoints

1. Homepage: original reference beside the implemented page at the same 1086px width in `review.html`; full desktop/mobile candidates under `visual-candidates/`. Three-part hero, portrait, route input/actions, Judgment/evidence preview, protocol, destination cards, developer section and footer are restored. Intentional differences: readable minimum metadata, accessible targets, shared lifecycle with an architecture-reference label, and API example clearly marked illustrative. NO CHECK RUN / AWAITING EVIDENCE / NOT CHECKED / NOT ISSUED remain accurate; confidence is unassessed. No fake live pulse or fabricated receipt.
2. Remaining routes: controlled unavailable-evidence candidates for Solana, Spend, Judgment/receipt missing detail, RH desk, Routes, LoopLab, Developers and mobile navigation. These candidates complement actual local seed/compatibility captures in evidence/. They preserve distinct tasks under one identity. Human approval has **not** been inferred. `test:ui:visuals` exits HOLD until a human-reviewed baseline manifest exists; changed pixels are never auto-approved.

Capture fixtures fix time, locale, timezone, reduced motion, viewport and API unavailable states; system fonts are reused. A successful private/paid Judgment fixture is not invented. The final capture manifest records its source SHA.

## Mobile and accessibility

Chromium 156 emulation covers 320/375/390/430/768/1024/1440px for all 137 samples. Consolidated latest checks: one canonical header/footer, cyan palette, no page errors, no page overflow, no axe AA violations at 375px; representative desktop and 390px checks also recorded. Solana async loading labels gained valid status roles. Initial contrast/scroll failures and their repairs remain in earlier run files.

Journeys pass: recoverable API error → retry → honest empty results; 403 receipt state; input/loading/disabled submission; explicit ALLOW with pending execution and missing evaluation; keyboard focus; Escape/restored navigation and network focus; reduced motion; long labels; and 200% text scaling. Six representative pages additionally reflow at 200% without page overflow. Mobile portrait download and homepage API requests are both zero; desktop retains the 74,906-byte WebP with reserved image dimensions.

**AA sign-off remains HOLD:** axe incomplete findings need manual adjudication; VoiceOver/TalkBack, real browser zoom UI, real-device Safari/Android, physical touch and virtual keyboard behavior were not verified. Installed WebKit hung during page creation and its diagnostic was terminated; this is not a Safari pass. Authenticated private proof and paid/wallet journeys remain unqualified. Emulation is not real-device testing.

## Performance

Fresh same-dependency Vite comparison against 068df23: entry JS +8.62kB raw / +2.81kB gzip; entry CSS +12.88kB raw / +1.75kB gzip; research JS −129.32kB raw / −23.09kB gzip; workflow CSS −8.84kB raw / −5.32kB gzip. Exact bytes and asset names are in evidence/bundle-comparison.json. Primary Spend Terminal now loads its existing component independently of the research dispatcher. Research still has a >500kB chunk warning; it is not suppressed.

| Local Lighthouse laboratory sample | Performance | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: |
| Homepage desktop | 100 | 487ms | 0ms | 0 |
| Homepage simulated mobile | 99 | 1,636ms | 13ms | 0 |
| Spend simulated mobile before separate entry | 55 | 4,253ms | 2,941ms | 0 |
| Spend simulated mobile after separate entry | 98 | 2,412ms | 7ms | 0 |

Lighthouse accessibility and best-practices scores are recorded in evidence/lighthouse-summary.json; accessibility was 100 in these samples. Local fresh-context FCP/CLS readings cover home/spend/Solana/Reflexive; CLS 0 and no overflow. Single runs are not a statistically qualified speed guarantee, and host load varied. **No field p75 CWV or production INP pass is claimed. TBT is not INP.** Production journeys, field telemetry and remaining deep-route budgets remain HOLD.

## Tests and source boundaries

Qualified runtime source: `f7fb3c8056d9c4e87dacee6070ffdb8e6de2af8f`. Final Node 24.21.0 run with two workers: **252 files / 1,867 tests passed; 9 files / 19 tests skipped; zero failures.** Typecheck, lint (the existing TypeScript lint command), server/client production build, design drift check and git diff check passed. Browser and mobile results are consolidated from the final 137-route sweep and scoped loading/spend follow-ups.

An earlier frozen-source run under heavy concurrency failed existing server-child startup and response-cache timing assertions. Their isolated serial rerun passed without relaxing deadlines or changing backend assertions; the final complete run passed. Earlier failure logs are preserved. Skipped PostgreSQL suites remain skipped, not passed.

No diff to backend algorithms, services, contracts/schemas, API, authentication, authorization, signing, payment execution, receipt authority, policy rules, persistence or migrations relative to main. UI legacy catalog diagnostics are explicitly separated from canonical Judgment; absent canonical evidence is unavailable, not permission. The service input is visible for review and preserves the separate existing MONITOR settlement behavior. No wallet execution or payment was added.

## Commits and integration HOLD

Reviewable branch `codex/radar-terminal-identity-recovery`: e9dc2e7 audit/reference; 839a405 shell/tokens/lifecycle; 578e0b7 homepage; 6138e65 workflow grammar; 771fd3d readability/input/reflow; 244f552 governance; db056a7 headline check; 779d4e4 loading semantics; f7fb3c8 spend loading performance; 5796e3d deterministic capture refinement. Final evidence/report commit is visible in git log and contains no runtime UI changes.

The current release lineage was inspected read-only, resolved during audit to c1f0d3d752ff9f8a7684d24c73bc78a22c0c0db9, and carries canonical tenant-aware Spend Terminal and security changes absent from this older recovery baseline. A merge-tree rehearsal identifies conflicts (integration-conflicts.txt). **Do not merge this branch wholesale into that release lineage or replace its canonical Spend Terminal with this baseline's legacy diagnostic workflow.** Forward-integrate only presentation into a frozen, independently reviewed release SHA, preserve its authenticated canonical contracts, and rerun its private/paid/security/PostgreSQL qualification. See integration-readiness.md.

Remaining blockers: both human visual checkpoints; forward integration/security review on the release baseline; manual/real-device/AT accessibility; skipped database qualification; production p75/INP and deep-route performance budgets. The local backend must be restored from the deliberately selected baseline before current live API journeys can be requalified; historical worktrees must not be silently repointed.

**Verdict: HOLD for merge/release.** Canonical recovery implementation and automated Chromium UI checks are ready for the requested two reviews. No merge, deployment, security gate waiver or automatic visual approval occurred.
