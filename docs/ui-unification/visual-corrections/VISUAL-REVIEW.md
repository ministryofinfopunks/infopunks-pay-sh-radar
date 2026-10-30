# Visual correction comparison

**REVIEW_REQUIRED — independent approval pending. Release HOLD.** Before subpages are the exact reviewed `7f44417fcad683a48397dad251f5d4245aa34643` candidate. Canonical homepage controls use an immutable `d3d0a445ec20e8c55170c2fc1f52aff220b2a851` archive. All images are actual browser captures. Genuine fixture GET replay holds data and timestamps constant; interaction checks call the actual local API.

## Complete pages

| Page | 1440px before / after | 390px before / after |
|---|---|---|
| Homepage control | [Before](evidence/homepage-control-before-desktop.png) / [After](evidence/homepage-control-after-desktop.png) | [Before](evidence/homepage-control-before-mobile.png) / [After](evidence/homepage-control-after-mobile.png) |
| Solana | [Before](evidence/before-solana-desktop.png) / [After](evidence/after-solana-desktop.png) | [Before](evidence/before-solana-mobile.png) / [After](evidence/after-solana-mobile.png) |
| Robinhood | [Before](evidence/before-robinhood-desktop.png) / [After](evidence/after-robinhood-desktop.png) | [Before](evidence/before-robinhood-mobile.png) / [After](evidence/after-robinhood-mobile.png) |

## First viewport

| Page | 1440×1000 before / after | 390×844 before / after |
|---|---|---|
| Solana | [Before](evidence/before-solana-desktop-viewport.png) / [After](evidence/after-solana-desktop-viewport.png) | [Before](evidence/before-solana-mobile-viewport.png) / [After](evidence/after-solana-mobile-viewport.png) |
| Robinhood | [Before](evidence/before-robinhood-desktop-viewport.png) / [After](evidence/after-robinhood-desktop-viewport.png) | [Before](evidence/before-robinhood-mobile-viewport.png) / [After](evidence/after-robinhood-mobile-viewport.png) |

## Requested details

| Detail | Desktop before / after | Mobile before / after |
|---|---|---|
| VR-01: hero status | [Before](evidence/before-robinhood-hero-status-desktop.png) / [After](evidence/after-robinhood-hero-status-desktop.png) | [Before](evidence/before-robinhood-hero-status-mobile.png) / [After](evidence/after-robinhood-hero-status-mobile.png) |
| VR-01: Daily Pulse | [Before](evidence/before-robinhood-pulse-desktop.png) / [After](evidence/after-robinhood-pulse-desktop.png) | [Before](evidence/before-robinhood-pulse-mobile.png) / [After](evidence/after-robinhood-pulse-mobile.png) |
| VR-02: complete Daily Receipt | [Before](evidence/before-robinhood-receipt-desktop.png) / [After](evidence/after-robinhood-receipt-desktop.png) | [Before](evidence/receipt-native-before-mobile.png) / [After](evidence/receipt-native-after-mobile.png) |
| VR-03: Solana coverage/source panel | [Before](evidence/before-solana-evidence-desktop.png) / [After](evidence/after-solana-evidence-desktop.png) | [Before](evidence/before-solana-evidence-mobile.png) / [After](evidence/after-solana-evidence-mobile.png) |
| VR-04: directory count labels | [Before](evidence/before-solana-directory-desktop.png) / [After](evidence/after-solana-directory-desktop.png) | [Before](evidence/before-solana-directory-mobile.png) / [After](evidence/after-solana-directory-mobile.png) |

The complete mobile receipt uses a native viewport clip at 390px width with a 2500px capture window so all eight evidence fields and footer controls are painted in one image. [Capture geometry and full text](evidence/receipt-native-capture.json) identify the actual dimensions; [reproducible driver](evidence/capture-receipt-native.cjs) changes no styles or content. Ordinary 390×844 receipt [top](evidence/after-robinhood-mobile-tile-rh-v2-receipt-1.png) and [bottom](evidence/after-robinhood-mobile-tile-rh-v2-receipt-2.png) tiles provide the standard-height view. Earlier locator-capture artifacts remain in the evidence/attempt history and do not replace the complete native clips.

## Homepage and unrelated-route stability

[Homepage comparison](evidence/homepage-control-results.json) requires and passes exact complete/viewport PNG equality at desktop and mobile, plus identical measured geometry, text, fonts and colors. [Separate RH narrative comparison](evidence/robinhood-narrative-control-results.json) passes the same controls. A first one-level rounded-border raster difference on the narrative route is retained and diagnosed in [VALIDATION.md](VALIDATION.md); neither source nor tolerance was changed.

The existing approved-reference gate independently reports zero changed pixels for homepage and Spend Terminal at both widths. Four changed subpage captures remain [REVIEW_REQUIRED](approved-visual-comparison/results.json). All approved references remain untouched.

The visual review should confirm the stale/historical status is understood before signals, the receipt's headline is a focal point without losing evidence, and the Solana panel clearly describes coverage rather than a cleared route. Optional imagery and mobile navigation are deliberately absent. Automated captures and axe checks do not constitute human approval or manual screen-reader/device testing.
