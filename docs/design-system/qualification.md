# Radar UI qualification — 2026-10-12

## Implementation status

Shared shell, global token consolidation, indexed identity, navigation, evidence status and receipt lifecycle are implemented above every UI dispatcher. 129 distinct anchored router patterns are inventoried; 137 representative concrete route/alias/detail URLs across the initial sweep and scoped follow-ups were rendered in Chromium across 320, 375, 390, 430, 768, 1024 and 1440 CSS px. See route-inventory.md, route-patterns.json and evidence/route-samples.json. API/JSON/health contracts were excluded. No backend files, security policy, payment gate or protocol contract was changed.

The exact requested indexed homepage text did not exist in the baseline. The actual lightweight homepage remains canonical; its thesis, type hierarchy, economic sequence, two-economy entry and restrained green remain. The requested indexed grammar is now shared.

## Mobile issues corrected

- Repeated global navigation and fragmented network contexts: entry shell owns chrome; existing menus and workflow controls retained.
- Solana preflight buried after intelligence modules: the existing control now precedes the directory; examples follow inputs/results. Primary hero action opens preflight. View controls use native progressive disclosure.
- Builder metrics above the mobile task: metrics follow the main workflow. Seeded compatibility catalog evidence and seed-authored LoopLab/proof records are explicitly labeled demonstration; catalog metrics are not live execution proof.
- Forms/controls: readable mobile inputs, numeric keyboards/ranges, 44px primary targets, focus/press/disabled states. Technical identifiers and long titles wrap.
- Silent collection failures and indefinite detail loading: explicit error/empty/loading, retry and permission denial. New pre-spend requests clear previous results.
- Evidence integrity: availability/freshness/publication no longer establish verified status; missing canonical Judgment no longer defaults to DEGRADE. Historical receipt references do not complete a new execution/evaluation.
- Scroll accessibility: code examples, machine tables, observatory/reflexive tables and Hermes flows are keyboard reachable. Every column remains available, with mobile scroll hints.
- Accessibility: claim links meet target spacing, Signal Graph has interactive group semantics, score rails have meter semantics; market/PLTR/4663 contrast improved.
- Reduced motion removes animation while preserving feedback. No synthetic telemetry or verification animation was introduced.

## Browser coverage and evidence

The Chromium sweep records no page errors or horizontal page overflow at the seven requested widths. The initial axe sweep found contrast, target sizing, scroll-region, ARIA and graph issues; fixes were applied and targeted rechecks recorded. Individual result files retain their actual chronology. A final 23-test shared/proof/LoopLab regression also passed after the explicit seed labels. The consolidated result uses the latest recorded check for each route; older failures are retained as evidence, not represented as current passes.

Screenshots include before mobile captures (home, Solana, spend, Reflexive), after core/operational captures at 375/768/1440 and viewport views. These are real local renders. Initial captures under `after--*` are intermediate, before the final corrections; final captures use `chromium-*`, `chromium-core-final-*` and `viewport-*`. The pending Judgment screenshot contains explicitly labeled browser demonstration data.

Journey qualification at 320px exercises: failed request → retry → empty records; a 403 receipt response; 200% root text scaling; touch submission; disabled loading action; canonical ALLOW with pending execution/missing evaluation; keyboard focus; Escape/restored focus for navigation and network selection; reduced motion; long-title wrapping. It does not sign a wallet transaction or enable payment.

## Commands

- Before edits: `npm run typecheck`, `npm run build` passed on dfe089b. The first migration test sweep passed 251 files / 1855 tests, with 9 files / 19 tests skipped; it was run during implementation and is not claimed as an untouched-baseline test run.
- Migration: `npm run check:design`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`.
- Regression qualification: `npm test -- --maxWorkers=4 --testTimeout=15000`; 252 files passed, 9 skipped; 1869 tests passed, 19 skipped. Exact counts are recorded in evidence/validation-summary.json. Earlier runs exposed stale navigation expectations, repaired to test the actual Services destination and /solana documentation anchors. One overloaded concurrent run hit the existing 5-second test timeout; final qualification uses 15 seconds.
- `RADAR_UI_BROWSERS=chromium npm run test:ui`: initial 136 URLs × seven viewport sizes, plus //4663 in scoped follow-up. Targeted follow-ups use RADAR_UI_ROUTES and RADAR_UI_RUN_LABEL; results retained.
- `npm run test:ui:journeys`: mobile recovery, evidence and input semantics.
- `node scripts/measure-radar-render.cjs`: local built-preview performance at 390px; exact measurements in evidence/render-performance.json.

## Performance and limitations

Baseline entry JS: 201.81 kB / 63.61 kB gzip. Shared navigation/identity adds about 22.5 kB raw / 5.3 kB gzip. Deep route JS stays about 1.29 MB; its existing >500 kB build warning remains. Workflow CSS fell from 417.61 kB to about 413 kB through consolidated root definitions. Shared entry CSS grows to about 30 kB. No production UI dependency or font was added; remote stylesheet font requests were removed and the homepage system type roles were reused.

Local fresh-context measurements are unthrottled and are not mobile-device/production performance claims. Loading content reserves viewport space to avoid moving global chrome. The four local samples measured FCP at 40–64 ms and CLS 0 after reserving loading space. Before the loading-space correction, Reflexive measured CLS 0.229. These measurements are local unthrottled observations, not real-device or production guarantees.

WebKit launched but could not open a page within a bounded 30-second diagnostic on this frozen macOS browser runtime. Safari on iOS, Chrome on Android, VoiceOver/TalkBack, physical touch devices, and the real virtual keyboard could not be qualified. Emulation does not claim these passes. No authenticated tenant/private receipt or wallet signing journey was run; a mocked 403 tests the frontend permission state and existing backend regression checks remain authoritative. PostgreSQL-dependent tests skipped without the configured database remain skipped.

## Acceptance boundary

Chromium responsive/accessibility and representative frontend journey qualification are recorded in validation-summary.json. Real-device, Safari and authenticated production journeys remain unqualified. This is a reviewable UI migration, not production/launch qualification, deployment or a merge. Known critical mobile failures must block qualification; document any new failure and continue repair before claiming a pass.
