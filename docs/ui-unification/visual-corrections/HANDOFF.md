# Visual acceptance corrections

**Ready for independent visual review. Release: HOLD. Changed-page baselines: REVIEW_REQUIRED.**

Branch: `codex/radar-ui-visual-corrections`, created from the exact reviewed candidate `7f44417fcad683a48397dad251f5d4245aa34643`. Canonical homepage baseline remains `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. The final local commit SHA is provided with the delivery; use `git rev-parse HEAD` on this branch to identify it.

This pass implements the supplied independent art-direction review. It preserves the earlier functional refactor and its historical reports. Review only `git diff 7f44417fcad683a48397dad251f5d4245aa34643..HEAD` for these corrections.

## Corrections

| Review item | Implementation and evidence |
|---|---|
| VR-01 | Both Robinhood home headers now put the actual market state, explicit “Historical observation” when stale, and the existing observation timestamp before the signals. The existing table rows, per-card states, source links and timestamps remain. No freshness evaluator or request changed. Missing state remains `source required`; fresh/aging/stale are rendered literally. The separate narrative route receives no added status line. |
| VR-02 | Daily Receipt uses the homepage's 800-weight editorial scale, 1.08 leading, tight tracking and a 28-character maximum measure. Canonical spacing separates identification, claim, stale state and evidence. At 1440px the headline is 51.12px with an 861.75px measure; at 390px it is 31.98px and fits the panel. All eight fields, manual status, date, observed time, source count, full-receipt link and share controls are preserved. No signed/verified claim was added. |
| VR-03 | “Radar coverage / source state” heads the Solana evidence panel. The real fixture-backed state immediately follows it, with canonical caution treatment. Coverage metrics retain exact zero/unknown values; missing trust remains UNKNOWN. Source and freshness remain beside the metrics. The retained slogan is secondary copy below the provenance. A short explanation distinguishes catalog coverage from a route judgment. |
| VR-04 | Existing numbers gain the literal label `surfaces` only on this Solana home directory. The counts, six families, destinations and all card dimensions remain identical at all eight required widths. |

VR-05 mobile section navigation and VR-06 optional imagery remain separate recommendations. Neither is implemented. No imagery, navigation, token values, shared shell or canonical homepage changed.

## Changed files

| File | Reason |
|---|---|
| `src/web/radarApp.tsx` | Reorders existing Solana evidence, promotes source state, clarifies coverage, preserves all metric/source expressions |
| `src/web/radarSubpages.css` | Scoped evidence hierarchy and token-based caution treatment, without legacy `!important` overrides |
| `src/web/radarNetworks.tsx` | Home-only directory count clarification |
| `src/web/rhChainSignalDeskV2.tsx` | Stateless, home-only status presentation using existing state and observation time |
| `src/web/rhChainTerminal.css` | Scoped status line and receipt editorial hierarchy |
| `tests/radar-endpoint-intelligence.test.tsx` | Unknown/zero ordering, fixture truth and exact directory counts |
| `tests/radar-subpage-presentation.test.tsx` | Stale/aging/fresh/missing-state truth, original observation time, narrative isolation and all receipt fields/controls |
| `scripts/browser-radar-ui-corrections.cjs` | Focused before/after captures and preservation assertions |
| `docs/ui-unification/visual-corrections/` | Review report, exact source manifests, original command output, screenshot comparisons and retained failed attempts |

The complete file inventory is [CHANGED-FILES.txt](CHANGED-FILES.txt). The supplied `evidence.zip` and unrelated `docs/qualification/` remain untracked and are excluded.

## Qualification

**2,056 tests pass, zero failures or skips**, across 283 test files. Build, lint, typecheck and design guard pass. The final eight-part browser run passes: all requested widths, actual interactions, automated accessibility, native 200%/400% zoom, lower-fold content, controlled homepage/narrative equality and preservation comparison. Additional existing browser gates pass 28 route/width checks and 33 route/view audits. Full results and limitations are in [VALIDATION.md](VALIDATION.md).

Both 1440px and 390px homepage controls are byte-identical to the immutable canonical baseline, including full pages and viewports. The existing human-approved comparison reports zero changed pixels for homepage and Spend Terminal; four redesigned-page captures remain REVIEW_REQUIRED. No approved reference was updated. Before/after evidence, including the complete Daily Receipt and Solana panel, is indexed in [VISUAL-REVIEW.md](VISUAL-REVIEW.md).

Static verification against the reviewed candidate confirms 1,834 protected tracked files unchanged. Existing handlers, destinations, state hooks and requests remain byte-equivalent in the touched TSX bindings. The original cyan-boundary check also passes. Backend contracts, market data, evidence/receipt authority, authorization, dependencies, security/migration gates and payment execution are unchanged.

## Remaining holds and local review

Independent visual approval is still required. No manual screen-reader, physical-device or virtual-keyboard qualification is claimed; 374 incomplete axe nodes in the broader audit remain available for human assessment. The inherited ambiguous Search selector, 57 existing project static findings, low development-only dependency advisory, Analyst duplicate-key warnings and independent operational/security gates remain recorded and unresolved. This visual pass does not change those gates.

The existing user-requested local preview remains running at [Homepage](http://localhost:5173/), [Solana](http://localhost:5173/solana), and [Robinhood](http://localhost:5173/rh-chain-signal-desk), using clearly labeled local fixture data. Temporary comparison servers and the disposable regression database are stopped after verification; see `cleanup.json`.

No push, merge, deployment, production configuration change or automatic visual approval was performed.
