# Scoped correction evidence

Original captures are observations from the authorized audit, not new implementation approvals. Final after/state captures use the fully qualified application `1e7114e`; actual synthetic API evidence and controlled response cases are labeled in their JSON results. Desktop is 1440px; mobile is a Chromium CSS viewport at 390px. Images do not establish device or assistive-technology qualification.

| ID | Before | Final after / acceptance record |
|---|---|---|
| UX-01 | [Tenant error](../03-spend-key-error.jpg) | [Mobile corrective field](interactions/UX-01-390.png), [desktop](interactions/UX-01-1440.png) |
| UX-02 | [Premature no-results](../11-search-before-submit-final.jpg) | [Draft state](after/02-390.txt), [confirmed empty](interactions/UX-02-empty-390.png), [unavailable](interactions/UX-02-503-390.png), [search error](interactions/UX-02-bad-1440.png) |
| UX-03 | [Wrong economy](../routes/018.jpg) | [Direct missing share](after/03-1440.png), [supported controlled Robinhood share](interactions/UX-03-04-ready-1440.png), [preserved context assertions](interactions/results.json) |
| UX-04 | [Missing pair](../routes/012.jpg), [campaign](../routes/004.jpg) | [Pair recovery](interactions/UX-04-pair-qualification-missing-record-390.png), [campaign recovery](interactions/UX-04-campaign-qualification-missing-record-1440.png), [service unavailable](interactions/UX-03-04-503-390.png) |
| UX-05 | [Transient native validation](../05-budget-validation.jpg) | [Actual focused mobile viewport](interactions/UX-05-390-viewport.png), [desktop durable error](interactions/UX-05-1440.png), [capture geometry](interactions/focus-capture-geometry.json) |
| UX-06 | [Run-together lifecycle](../06-pending-execution.jpg) | [Separated mobile stages](interactions/UX-07-13-390.png), [desktop Spend stages](interactions/UX-08-1440.png) |
| UX-07 | [JSON-only provenance](../07-execution-source-open.jpg) | [Returned summary and parent link](interactions/UX-07-13-1440.png), [owned Evaluation](journeys/mobile-evaluation.png) |
| UX-08 | [General follow-up](../04-insufficient-evidence.jpg) | [Exact subject follow-up](interactions/UX-08-390.png), [known/unknown link tests](../../../../tests/ux-hardening.test.tsx) |
| UX-09 | [Lost filter context](../10-route-filter.jpg) | [Refresh/back/forward assertions](interactions/results.json), [real filter/sort journey](journeys/results.json) |
| UX-10 | [Duplicate heading DOM](../routes/030.txt) | [Developers DOM](after/10-1440.txt), [RH narrative DOM](after/11-390.txt), [landmark assertions](interactions/results.json) |
| UX-11 | [Audit payload](../current-bundles.json) | [Final fixture replay](performance-final.json), [paired summary](performance-summary.json) |
| UX-12 | [Permanently masked key](../02-spend-mobile-initial.jpg) | [Usable shared key field](interactions/UX-01-390.png), [receipt key field](interactions/UX-07-13-1440.png), [keyboard/state assertions](interactions/results.json) |
| UX-13 | [Wrong proof parent](../06-pending-execution.jpg) | [Proof archive breadcrumb/context](interactions/UX-07-13-390.png) |

The full [before](before/states.json) and [after](after/states.json) state logs retain 13 route samples at both widths, including text and headings. Search/quote/service-failure images explicitly show synthetic controlled responses; receipt and insufficient-evidence images use the disposable tenant-aware API. No captured quote submits payment or executes an action.

The [frozen-reference comparison](visual-comparison/results.json) contains six automated tolerance passes and four review-required candidates. Homepage and Robinhood desk are pixel-identical at both widths. G1 remains inherited PASS; all scoped candidate review and corrected Solana G2 approval remain human decisions.
