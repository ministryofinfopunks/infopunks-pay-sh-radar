# Radar R1 bounded correction register

Authority: user RADAR-R1 Track D and completed RADAR-24 audit findings 6, 7 and 8, read from the shared workspace. Base 8c3d37eed56c245ca843e7ff3cf90cec5ff3139c. Only the following corrections are authorized in this candidate; no visual redesign, authority/migration/receipt-policy change, remote mutation or new feature.

| ID | Existing finding | Bounded correction | Acceptance |
|---|---|---|---|
| R24-06 | Invalid successful evidence becomes empty/crashes; optional receipt outage becomes zero | Validate existing Unicorn and machine read contracts; recover with canonical unavailable/retry; do not show proof counts after required evidence failure | Malformed/empty/503/read-only retry probes and existing route tests |
| R24-07A | Enrichment re-stamps cached market data; unavailable orders becomes healthy zero | Existing marketDataUpdatedAt uses original provider capture time; no stale-on-error refresh claim; null for unavailable counts; label recent/cache/historical/unavailable separately | Fixed clock cache replay and missing-data tests; existing response shape preserved |
| R24-07B | OpenAPI omits operator authorization401 and Hermes services GET | Generated OpenAPI already adds the operator guard/401; correct the audit interpretation and add the genuinely omitted services endpoint only, without changing authority | OpenAPI schema/method/401 assertions |
| R24-08 | Lazy homepage root hash fails to align/focus | Align known existing root sections after mount/hashchange, no arbitrary URL decoding or new route | Root proof landing/keyboard focus; existing homepage/QA2 regressions |

Canonical ownership: RadarAsyncState for recoverable reads; existing schemas for Unicorn contract; existing API helper for timeouts; native selectors/platform popups; RadarAppShell and radarTokens.css unchanged. English product UI; no Japan market/localization change. Forms and unrelated static findings are not expanded into a redesign. All new behavior remains an independent review candidate, not approved release.
