# Screenshot review

Selected source: `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. These are screenshots of the actual local application, not mockups. The fixture API snapshots are genuine existing application responses; no evidence, score, proof or approval state was fabricated. Screenshot response replay keeps source data/timestamps stable for visual comparisons. Interactive checks use the actual local API.

## Complete before / after pages

| Page | Desktop before (1440px) | Desktop after (1440px) | Mobile before (390px) | Mobile after (390px) |
|---|---|---|---|---|
| Canonical homepage | [Before](evidence/cyan-baseline/homepage-control-before-desktop.png) | [After](evidence/cyan-baseline/homepage-control-after-desktop.png) | [Before](evidence/cyan-baseline/homepage-control-before-mobile.png) | [After](evidence/cyan-baseline/homepage-control-after-mobile.png) |
| Solana Radar | [Before](evidence/cyan-baseline/before-solana-desktop.png) | [After](evidence/cyan-baseline/after-solana-desktop.png) | [Before](evidence/cyan-baseline/before-solana-mobile.png) | [After](evidence/cyan-baseline/after-solana-mobile.png) |
| Robinhood Chain | [Before](evidence/cyan-baseline/before-robinhood-desktop.png) | [After](evidence/cyan-baseline/after-robinhood-desktop.png) | [Before](evidence/cyan-baseline/before-robinhood-mobile.png) | [After](evidence/cyan-baseline/after-robinhood-mobile.png) |

## First viewport

| Page | Desktop before / after | Mobile before / after |
|---|---|---|
| Homepage | [Before](evidence/cyan-baseline/homepage-control-before-desktop-viewport.png) / [After](evidence/cyan-baseline/homepage-control-after-desktop-viewport.png) | [Before](evidence/cyan-baseline/homepage-control-before-mobile-viewport.png) / [After](evidence/cyan-baseline/homepage-control-after-mobile-viewport.png) |
| Solana | [Before](evidence/cyan-baseline/before-solana-desktop-viewport.png) / [After](evidence/cyan-baseline/after-solana-desktop-viewport.png) | [Before](evidence/cyan-baseline/before-solana-mobile-viewport.png) / [After](evidence/cyan-baseline/after-solana-mobile-viewport.png) |
| Robinhood Chain | [Before](evidence/cyan-baseline/before-robinhood-desktop-viewport.png) / [After](evidence/cyan-baseline/after-robinhood-desktop-viewport.png) | [Before](evidence/cyan-baseline/before-robinhood-mobile-viewport.png) / [After](evidence/cyan-baseline/after-robinhood-mobile-viewport.png) |

## Focused mobile evidence

Use the bounded viewport tiles to inspect small text. Full pages above retain every section; tiles make below-fold review easier.

- Solana directory: [top](evidence/cyan-baseline/after-solana-mobile-tile-radar-route-directory-1.png), [lower](evidence/cyan-baseline/after-solana-mobile-tile-radar-route-directory-2.png).
- Solana evidence: [top](evidence/cyan-baseline/after-solana-mobile-tile-solana-evidence-brief-1.png), [lower](evidence/cyan-baseline/after-solana-mobile-tile-solana-evidence-brief-2.png).
- Solana benchmarks: [tile](evidence/cyan-baseline/after-solana-mobile-tile-benchmark-readiness-1.png).
- Solana preflight: [tile](evidence/cyan-baseline/after-solana-mobile-tile-preflight-1.png).
- Solana route mappings: [tile](evidence/cyan-baseline/after-solana-mobile-tile-route-mapping-registry-1.png).
- RH Daily Pulse: [tile](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-today-1.png).
- RH Daily Receipt: [top](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-receipt-1.png), [lower](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-receipt-2.png).
- RH movers: [tile](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-movers-1.png).
- RH risk / Meme Pulse: [risk](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-risk-radar-1.png), [Meme Pulse](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-memes-1.png).
- RH launch / review / chain pulse / methodology: [launch](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-routes-1.png), [review](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-review-1.png), [chain pulse](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-chain-pulse-1.png), [methodology](evidence/cyan-baseline/after-robinhood-mobile-tile-rh-v2-methodology-1.png).
- RH expanded contract result and Analyst table: [contract](evidence/cyan-baseline/after-robinhood-contract-mobile.png), [table](evidence/cyan-baseline/after-robinhood-table-mobile.png).

## Unchanged homepage and narrative route

The controlled comparisons use the immutable before source and candidate with the same exact Playwright/Chrome version, viewport, software renderer and warm-up capture. Desktop and mobile complete PNGs and viewport PNGs are byte-identical, and measured geometry, text, fonts and colors match. See [homepage-control-results.json](evidence/cyan-baseline/homepage-control-results.json) and [robinhood-narrative-control-results.json](evidence/cyan-baseline/robinhood-narrative-control-results.json).

Initial GPU captures had tiny raster noise (102 desktop and 29 mobile pixels, small channel differences), retained in the raw comparison. They were investigated rather than approved as homepage changes. Controlled matching-renderer captures resolve that noise and establish the exact unchanged result. Human-approved historical references remain immutable.

## Viewports, zoom and limitations

Actual browser layout checks cover 360, 375, 390, 768, 1024, 1280, 1440 and 1920px on all three pages; the existing route gate also covers 320 and 430px. Native Chrome settings at 200% and 400% are tested through an isolated temporary browser profile with verified CSS viewport and DPR changes. [Native zoom evidence](evidence/cyan-baseline/after-native-zoom-results.json) is separate from viewport-reflow checks.

These captures do not certify physical devices, mobile virtual keyboards or manual screen readers. Automated accessibility incomplete results require human interpretation. New subpage captures are **review candidates**, not self-approved visual baselines. Release remains HOLD pending the existing human and operational gates.
